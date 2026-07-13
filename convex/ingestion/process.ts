"use node"

import { v } from "convex/values"

import { internal } from "../_generated/api"
import type { Doc } from "../_generated/dataModel"
import { env, internalAction } from "../_generated/server"
import { OpenRouterApiError, OpenRouterProvider } from "../llm/openrouter"
import type { ChatCompletion } from "../llm/types"
import {
  INGESTION_MODEL,
  applyClassifications,
  buildClassificationPrompt,
  createClassificationBatches,
  parseClassificationResponse,
} from "./classify"
import type { Classification } from "./classify"
import { extractPdf } from "./extract"
import type { ExtractedBlock } from "./extract"

const MAX_COMPLETION_TOKENS = 2_048
const PERSIST_BATCH_SIZE = 75

const SYSTEM_PROMPT = `You classify extracted PDF text blocks for a reading application.
Remove only text that is clearly publication/legal/authorization boilerplate or navigation that is useless when reading the document aloud.
Keep titles, authors, headings, body text, quotations, footnotes, endnotes, citations, exhibit content, captions, and source lines.
Use review whenever uncertain. Never rewrite text. Return one decision for every supplied block.`

const RESPONSE_FORMAT = {
  type: "json_schema" as const,
  jsonSchema: {
    name: "pdf_block_classification",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["decisions"],
      properties: {
        decisions: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "label", "confidence"],
            properties: {
              id: { type: "string" },
              label: {
                type: "string",
                enum: [
                  "keep",
                  "remove_boilerplate",
                  "remove_navigation",
                  "review",
                ],
              },
              confidence: { type: "number", minimum: 0, maximum: 1 },
            },
          },
        },
      },
    },
  },
}

export const run = internalAction({
  args: { documentId: v.id("documents") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const document: Doc<"documents"> | null = await ctx.runQuery(
      internal.documents.getForProcessing,
      { documentId: args.documentId }
    )
    if (!document || document.status !== "queued") return null

    await ctx.runMutation(internal.documents.beginProcessing, {
      documentId: args.documentId,
    })

    try {
      let hasMoreBlocks = true
      while (hasMoreBlocks) {
        hasMoreBlocks = await ctx.runMutation(internal.documents.clearBlocks, {
          documentId: args.documentId,
        })
      }

      const url = await ctx.storage.getUrl(document.originalStorageId)
      if (!url) throw new Error("The original PDF could not be loaded")
      const response = await fetch(url)
      if (!response.ok) throw new Error("The original PDF could not be loaded")

      const extracted = await extractPdf(
        new Uint8Array(await response.arrayBuffer())
      )
      await ctx.runMutation(internal.documents.setProgress, {
        documentId: args.documentId,
        progress: 35,
        pageCount: extracted.pageCount,
      })

      const apiKey = env.OPENROUTER_API_KEY
      if (!apiKey) throw new Error("OpenRouter is not configured")
      const provider = new OpenRouterProvider({
        apiKey,
        siteUrl: env.OPENROUTER_SITE_URL,
      })
      const batches = createClassificationBatches(extracted.blocks)
      let blocks = extracted.blocks

      for (let index = 0; index < batches.length; index += 1) {
        const batch = batches[index]
        const decisions = await classifyBatch({
          provider,
          batch,
          accountId: document.ownerId,
          reserve: async (tokens) => {
            await ctx.runMutation(internal.llm.usage.reserveTokens, {
              accountId: document.ownerId,
              tokens,
              now: Date.now(),
            })
          },
          reconcile: async (reservedTokens, actualTokens) => {
            await ctx.runMutation(internal.llm.usage.reconcileTokens, {
              accountId: document.ownerId,
              reservedTokens,
              actualTokens,
              now: Date.now(),
            })
          },
        })
        blocks = applyClassifications(blocks, decisions)
        await ctx.runMutation(internal.documents.setProgress, {
          documentId: args.documentId,
          progress:
            35 + Math.round(((index + 1) / Math.max(1, batches.length)) * 50),
        })
      }

      await ctx.runMutation(internal.documents.setProgress, {
        documentId: args.documentId,
        progress: 90,
      })
      for (let index = 0; index < blocks.length; index += PERSIST_BATCH_SIZE) {
        await ctx.runMutation(internal.documents.insertBlocks, {
          documentId: args.documentId,
          blocks: blocks
            .slice(index, index + PERSIST_BATCH_SIZE)
            .map(toStoredBlock),
        })
      }

      const keptBlockCount = blocks.filter(
        (block) => block.action === "kept"
      ).length
      await ctx.runMutation(internal.documents.completeProcessing, {
        documentId: args.documentId,
        pageCount: extracted.pageCount,
        blockCount: blocks.length,
        keptBlockCount,
        removedBlockCount: blocks.length - keptBlockCount,
      })
    } catch (error) {
      console.error("PDF ingestion failed", error)
      await ctx.runMutation(internal.documents.failProcessing, {
        documentId: args.documentId,
        error: userSafeError(error),
      })
    }
    return null
  },
})

async function classifyBatch(options: {
  provider: OpenRouterProvider
  batch: Array<ExtractedBlock>
  accountId: string
  reserve: (tokens: number) => Promise<void>
  reconcile: (reservedTokens: number, actualTokens: number) => Promise<void>
}): Promise<Array<Classification>> {
  const prompt = buildClassificationPrompt(options.batch)
  const reservedTokens =
    Math.ceil((SYSTEM_PROMPT.length + prompt.length) / 4) +
    MAX_COMPLETION_TOKENS
  await options.reserve(reservedTokens)

  let completion: ChatCompletion | null = null
  let actualTokens = 0
  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        completion = await options.provider.complete({
          model: INGESTION_MODEL,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: prompt },
          ],
          maxCompletionTokens: MAX_COMPLETION_TOKENS,
          temperature: 0,
          reasoningEffort: "minimal",
          responseFormat: RESPONSE_FORMAT,
        })
        actualTokens += completion.usage.totalTokens
        const parsed = parseClassificationResponse(
          completion.content,
          new Set(options.batch.map((block) => block.id))
        )
        if (parsed) return parsed
      } catch (error) {
        if (attempt === 1 || !isRetryable(error)) throw error
      }
    }
    return []
  } finally {
    await options.reconcile(reservedTokens, actualTokens)
  }
}

function isRetryable(error: unknown): boolean {
  return (
    !(error instanceof OpenRouterApiError) ||
    error.status === 429 ||
    error.status >= 500
  )
}

function toStoredBlock(block: ExtractedBlock) {
  return {
    order: block.order,
    pageStart: block.pageStart,
    pageEnd: block.pageEnd,
    text: block.text,
    action: block.action,
    ...(block.reason ? { reason: block.reason } : {}),
    ...(block.confidence === undefined ? {} : { confidence: block.confidence }),
  }
}

function userSafeError(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes("Scanned PDFs")) return error.message
    if (error.message.includes("OpenRouter is not configured"))
      return error.message
  }
  return "We couldn't process this PDF. Please verify the file and try again."
}
