"use node"

import { v } from "convex/values"

import { internal } from "../_generated/api"
import type { Doc, Id } from "../_generated/dataModel"
import type { ActionCtx } from "../_generated/server"
import { env, internalAction } from "../_generated/server"
import { ElevenLabsApiError, ElevenLabsProvider } from "./elevenlabs"

const PAGE_SIZE = 100
const DIALOGUE_CHARACTER_LIMIT = 2_000
const NARRATOR = "Narrator"
const VOICE_IDS = [
  "EkK5I93UQWFDigLMpZcX",
  "Z3R5wn05IrDiVCyEkUrK",
  "c6SfcYrb2t09NHXiT80T",
]

type Turn = { speaker: string; text: string }

export const run = internalAction({
  args: { documentId: v.id("documents") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const document: Doc<"documents"> | null = await ctx.runMutation(
      internal.documents.beginAudioGeneration,
      { documentId: args.documentId }
    )
    if (!document) return null

    let reservedCharacters = 0
    try {
      const apiKey = env.ELEVENLABS_API_KEY
      if (!apiKey) throw new Error("ElevenLabs is not configured")
      const blocks = await loadKeptBlocks(ctx, args.documentId)
      const turns = extractSpeakerTurns(blocks.map((block) => block.text))
      if (turns.length === 0)
        throw new Error("The document has no text to read")

      const characters = turns.reduce(
        (total, turn) => total + turn.text.length,
        0
      )
      await ctx.runMutation(internal.tts.usage.reserveCharacters, {
        accountId: document.ownerId,
        characters,
        now: Date.now(),
      })
      reservedCharacters = characters

      const speakers = [...new Set(turns.map((turn) => turn.speaker))]
      const voiceBySpeaker = new Map(
        speakers.map((speaker, index) => [
          speaker,
          VOICE_IDS[index % VOICE_IDS.length],
        ])
      )
      const batches = createDialogueBatches(turns)
      const provider = new ElevenLabsProvider({ apiKey })
      const audioParts: Array<Blob> = []
      for (const [index, batch] of batches.entries()) {
        const inputs = batch.map((turn) => ({
          text: turn.text,
          voiceId: voiceBySpeaker.get(turn.speaker)!,
        }))
        const speech = shouldUseDialogue(batch)
          ? await provider.synthesizeDialogue({ inputs, seed: 42 })
          : await provider.synthesize({
              text: inputs.map((input) => input.text).join("\n"),
              voiceId: inputs[0].voiceId,
              modelId: "eleven_v3",
              seed: 42,
            })
        audioParts.push(speech.audio)
        await ctx.runMutation(internal.documents.setAudioProgress, {
          documentId: args.documentId,
          progress: 10 + Math.round(((index + 1) / batches.length) * 85),
        })
      }

      const contentType = "audio/mpeg"
      const storageId = await ctx.storage.store(
        new Blob(audioParts, { type: contentType })
      )
      await ctx.runMutation(internal.documents.completeAudioGeneration, {
        documentId: args.documentId,
        storageId,
        contentType,
        speakerCount: speakers.length,
      })
    } catch (error) {
      console.error("Document audio generation failed", {
        documentId: args.documentId,
        error,
      })
      if (reservedCharacters > 0) {
        await ctx.runMutation(internal.tts.usage.refundCharacters, {
          accountId: document.ownerId,
          characters: reservedCharacters,
          now: Date.now(),
        })
      }
      await ctx.runMutation(internal.documents.failAudioGeneration, {
        documentId: args.documentId,
        error: userSafeAudioError(error),
      })
    }
    return null
  },
})

async function loadKeptBlocks(
  ctx: ActionCtx,
  documentId: Id<"documents">
): Promise<Array<Doc<"documentBlocks">>> {
  const blocks: Array<Doc<"documentBlocks">> = []
  let cursor: string | null = null
  let done = false
  while (!done) {
    const page: {
      page: Array<Doc<"documentBlocks">>
      continueCursor: string
      isDone: boolean
    } = await ctx.runQuery(internal.documents.getKeptBlocksForAudio, {
      documentId,
      paginationOpts: { numItems: PAGE_SIZE, cursor },
    })
    blocks.push(...page.page)
    cursor = page.continueCursor
    done = page.isDone
  }
  return blocks
}

export function extractSpeakerTurns(texts: Array<string>): Array<Turn> {
  const turns: Array<Turn> = []
  let activeSpeaker = NARRATOR
  for (const text of texts) {
    for (const rawLine of text.split(/\n+/)) {
      const line = rawLine.trim()
      if (!line) continue
      const labelled = line.match(/^([\p{L}][\p{L}\p{M} .'-]{0,48}):\s+(.+)$/u)
      if (labelled) {
        activeSpeaker = normalizeSpeaker(labelled[1])
        appendTurn(turns, activeSpeaker, labelled[2])
        continue
      }
      const quote = line.match(
        /^[“"](.+?)[”"](?:,?\s+(?:said|asked|replied|called)\s+([\p{L}][\p{L}\p{M} .'-]{0,48}))?[.!]?$/iu
      )
      if (quote) {
        const speaker = quote[2] ? normalizeSpeaker(quote[2]) : activeSpeaker
        appendTurn(turns, speaker, quote[1])
        activeSpeaker = speaker
        continue
      }
      appendTurn(turns, NARRATOR, line)
      activeSpeaker = NARRATOR
    }
  }
  return turns
}

function appendTurn(turns: Array<Turn>, speaker: string, text: string) {
  const cleaned = text.trim()
  if (!cleaned) return
  const previous = turns.at(-1)
  if (previous?.speaker === speaker) previous.text += `\n${cleaned}`
  else turns.push({ speaker, text: cleaned })
}

function normalizeSpeaker(speaker: string): string {
  return speaker.trim().replace(/\s+/g, " ")
}

export function createDialogueBatches(turns: Array<Turn>): Array<Array<Turn>> {
  const expanded = turns.flatMap(splitLongTurn)
  const batches: Array<Array<Turn>> = []
  let batch: Array<Turn> = []
  let length = 0
  for (const turn of expanded) {
    if (batch.length && length + turn.text.length > DIALOGUE_CHARACTER_LIMIT) {
      batches.push(batch)
      batch = []
      length = 0
    }
    batch.push(turn)
    length += turn.text.length
  }
  if (batch.length) batches.push(batch)
  return batches
}

export function shouldUseDialogue(turns: Array<Turn>): boolean {
  return new Set(turns.map((turn) => turn.speaker)).size > 1
}

function splitLongTurn(turn: Turn): Array<Turn> {
  if (turn.text.length <= DIALOGUE_CHARACTER_LIMIT) return [turn]
  const chunks: Array<Turn> = []
  let remaining = turn.text
  while (remaining.length > DIALOGUE_CHARACTER_LIMIT) {
    const window = remaining.slice(0, DIALOGUE_CHARACTER_LIMIT)
    const boundary = Math.max(window.lastIndexOf(". "), window.lastIndexOf(" "))
    const end =
      boundary > DIALOGUE_CHARACTER_LIMIT / 2
        ? boundary + 1
        : DIALOGUE_CHARACTER_LIMIT
    chunks.push({ speaker: turn.speaker, text: remaining.slice(0, end).trim() })
    remaining = remaining.slice(end).trim()
  }
  if (remaining) chunks.push({ speaker: turn.speaker, text: remaining })
  return chunks
}

function userSafeAudioError(error: unknown): string {
  if (error instanceof ElevenLabsApiError) {
    if (error.status === 401) {
      return "ElevenLabs rejected the API key. Check the Convex environment configuration."
    }
    if (error.status === 402) {
      return "The ElevenLabs account does not have enough credits for this audio."
    }
    if (error.status === 429) {
      return "ElevenLabs is rate-limiting audio generation. Please try again shortly."
    }
    return `ElevenLabs could not generate this audio (${error.status}): ${error.message}`
  }
  if (error instanceof Error) {
    if (error.message.includes("not configured")) return error.message
    if (error.message.includes("quota exceeded")) return error.message
    if (error.message.includes("no text")) return error.message
  }
  return "We couldn't generate audio for this document. Please try again."
}
