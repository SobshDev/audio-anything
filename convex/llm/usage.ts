import { v } from "convex/values"

import type { QueryCtx, MutationCtx } from "../_generated/server"
import { internalMutation, internalQuery, query } from "../_generated/server"
import { getPlanLimits } from "../plans"
import { startOfUtcWeek } from "../tts/usage"

const MILLISECONDS_PER_WEEK = 7 * 24 * 60 * 60 * 1_000

export const reserveTokens = internalMutation({
  args: { accountId: v.string(), tokens: v.number(), now: v.number() },
  handler: async (ctx, args) => {
    validateTokens(args.tokens)
    const limits = await getPlanLimits(ctx, args.accountId)
    const weekStart = startOfUtcWeek(args.now)
    const usage = await findUsage(ctx, args.accountId, weekStart)
    const used = usage?.usedTokens ?? 0

    if (used + args.tokens > limits.llmTokens) {
      throw new Error(
        `Weekly LLM quota exceeded: ${used.toLocaleString()} of ${limits.llmTokens.toLocaleString()} tokens used`
      )
    }

    if (usage) {
      await ctx.db.patch("weeklyLlmUsage", usage._id, {
        usedTokens: used + args.tokens,
      })
    } else {
      await ctx.db.insert("weeklyLlmUsage", {
        accountId: args.accountId,
        weekStart,
        usedTokens: args.tokens,
      })
    }

    return null
  },
})

export const reconcileTokens = internalMutation({
  args: {
    accountId: v.string(),
    reservedTokens: v.number(),
    actualTokens: v.number(),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    validateTokens(args.reservedTokens)
    if (!Number.isSafeInteger(args.actualTokens) || args.actualTokens < 0) {
      throw new Error("Actual token count must be a non-negative integer")
    }

    const weekStart = startOfUtcWeek(args.now)
    const usage = await findUsage(ctx, args.accountId, weekStart)
    if (!usage) return null

    await ctx.db.patch("weeklyLlmUsage", usage._id, {
      usedTokens: Math.max(
        0,
        usage.usedTokens - args.reservedTokens + args.actualTokens
      ),
    })
    return null
  },
})

export const getMyWeeklyUsage = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Authentication required")

    const now = Date.now()
    const limits = await getPlanLimits(ctx, identity.tokenIdentifier)
    const weekStart = startOfUtcWeek(now)
    const usage = await findUsage(ctx, identity.tokenIdentifier, weekStart)
    const used = usage?.usedTokens ?? 0
    return {
      limit: limits.llmTokens,
      used,
      remaining: Math.max(0, limits.llmTokens - used),
      resetsAt: weekStart + MILLISECONDS_PER_WEEK,
    }
  },
})

export const getUsageForAccount = internalQuery({
  args: { accountId: v.string(), now: v.number() },
  handler: async (ctx, args) => {
    const weekStart = startOfUtcWeek(args.now)
    const limits = await getPlanLimits(ctx, args.accountId)
    const usage = await findUsage(ctx, args.accountId, weekStart)
    const used = usage?.usedTokens ?? 0
    return {
      limit: limits.llmTokens,
      used,
      remaining: Math.max(0, limits.llmTokens - used),
      resetsAt: weekStart + MILLISECONDS_PER_WEEK,
    }
  },
})

function findUsage(
  ctx: QueryCtx | MutationCtx,
  accountId: string,
  weekStart: number
) {
  return ctx.db
    .query("weeklyLlmUsage")
    .withIndex("by_accountId_and_weekStart", (q) =>
      q.eq("accountId", accountId).eq("weekStart", weekStart)
    )
    .unique()
}

function validateTokens(tokens: number): void {
  if (!Number.isSafeInteger(tokens) || tokens <= 0) {
    throw new Error("Token count must be a positive integer")
  }
}
