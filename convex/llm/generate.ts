import { v } from "convex/values"

import { internal } from "../_generated/api"
import { action, env } from "../_generated/server"
import { OpenRouterProvider } from "./openrouter"
import type { ChatCompletion } from "./types"

const DEFAULT_MAX_COMPLETION_TOKENS = 4_096

type QuotaResult = {
  limit: number
  used: number
  remaining: number
  resetsAt: number
}

type GenerateTextResult = {
  id: string
  model: string
  content: string
  finishReason: string | null
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
    cost: number | null
  }
  quota: QuotaResult
}

export const generateText = action({
  args: {
    model: v.string(),
    prompt: v.string(),
    systemPrompt: v.optional(v.string()),
    maxCompletionTokens: v.optional(v.number()),
    temperature: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<GenerateTextResult> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Authentication required")
    if (!args.model.trim()) throw new Error("Model is required")
    if (!args.prompt.trim()) throw new Error("Prompt is required")

    const apiKey = env.OPENROUTER_API_KEY
    if (!apiKey) throw new Error("OpenRouter is not configured")

    const maxCompletionTokens =
      args.maxCompletionTokens ?? DEFAULT_MAX_COMPLETION_TOKENS
    if (
      !Number.isSafeInteger(maxCompletionTokens) ||
      maxCompletionTokens < 1 ||
      maxCompletionTokens > 8_192
    ) {
      throw new Error("maxCompletionTokens must be between 1 and 8192")
    }

    const messages = [
      ...(args.systemPrompt
        ? [{ role: "system" as const, content: args.systemPrompt }]
        : []),
      { role: "user" as const, content: args.prompt },
    ]
    const reservedTokens =
      messages.reduce(
        (total, message) =>
          total + new TextEncoder().encode(message.content).length,
        0
      ) + maxCompletionTokens
    const accountId = identity.tokenIdentifier
    const now = Date.now()

    await ctx.runMutation(internal.llm.usage.reserveTokens, {
      accountId,
      tokens: reservedTokens,
      now,
    })

    let completion: ChatCompletion
    try {
      const provider = new OpenRouterProvider({
        apiKey,
        siteUrl: env.OPENROUTER_SITE_URL,
      })
      completion = await provider.complete({
        model: args.model,
        messages,
        maxCompletionTokens,
        temperature: args.temperature,
      })
    } catch (error) {
      await ctx.runMutation(internal.llm.usage.reconcileTokens, {
        accountId,
        reservedTokens,
        actualTokens: 0,
        now,
      })
      throw error
    }

    await ctx.runMutation(internal.llm.usage.reconcileTokens, {
      accountId,
      reservedTokens,
      actualTokens: completion.usage.totalTokens,
      now,
    })
    const quota: QuotaResult = await ctx.runQuery(
      internal.llm.usage.getUsageForAccount,
      { accountId, now }
    )

    return {
      id: completion.id,
      model: completion.model,
      content: completion.content,
      finishReason: completion.finishReason,
      usage: completion.usage,
      quota,
    }
  },
})
