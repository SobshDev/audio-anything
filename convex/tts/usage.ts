import { v } from "convex/values"

import { internalMutation, query } from "../_generated/server"

export const FREE_WEEKLY_CHARACTER_LIMIT = 25_000
const MILLISECONDS_PER_WEEK = 7 * 24 * 60 * 60 * 1_000

export class TtsQuotaExceededError extends Error {
  constructor(
    readonly limit: number,
    readonly used: number,
    readonly requested: number,
    readonly resetsAt: number
  ) {
    super(
      `Weekly TTS quota exceeded: ${used.toLocaleString()} of ${limit.toLocaleString()} characters used`
    )
    this.name = "TtsQuotaExceededError"
  }
}

export const reserveCharacters = internalMutation({
  args: {
    accountId: v.string(),
    characters: v.number(),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    validateCharacterCount(args.characters)
    const weekStart = startOfUtcWeek(args.now)
    const usage = await ctx.db
      .query("weeklyTtsUsage")
      .withIndex("by_accountId_and_weekStart", (q) =>
        q.eq("accountId", args.accountId).eq("weekStart", weekStart)
      )
      .unique()
    const used = usage?.usedCharacters ?? 0

    if (used + args.characters > FREE_WEEKLY_CHARACTER_LIMIT) {
      throw new TtsQuotaExceededError(
        FREE_WEEKLY_CHARACTER_LIMIT,
        used,
        args.characters,
        weekStart + MILLISECONDS_PER_WEEK
      )
    }

    if (usage) {
      await ctx.db.patch("weeklyTtsUsage", usage._id, {
        usedCharacters: used + args.characters,
      })
    } else {
      await ctx.db.insert("weeklyTtsUsage", {
        accountId: args.accountId,
        weekStart,
        usedCharacters: args.characters,
      })
    }

    return {
      limit: FREE_WEEKLY_CHARACTER_LIMIT,
      used: used + args.characters,
      remaining: FREE_WEEKLY_CHARACTER_LIMIT - used - args.characters,
      resetsAt: weekStart + MILLISECONDS_PER_WEEK,
    }
  },
})

export const refundCharacters = internalMutation({
  args: {
    accountId: v.string(),
    characters: v.number(),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    validateCharacterCount(args.characters)
    const weekStart = startOfUtcWeek(args.now)
    const usage = await ctx.db
      .query("weeklyTtsUsage")
      .withIndex("by_accountId_and_weekStart", (q) =>
        q.eq("accountId", args.accountId).eq("weekStart", weekStart)
      )
      .unique()

    if (usage) {
      await ctx.db.patch("weeklyTtsUsage", usage._id, {
        usedCharacters: Math.max(0, usage.usedCharacters - args.characters),
      })
    }

    return null
  },
})

export const getMyWeeklyUsage = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Authentication required")

    const now = Date.now()
    const weekStart = startOfUtcWeek(now)
    const usage = await ctx.db
      .query("weeklyTtsUsage")
      .withIndex("by_accountId_and_weekStart", (q) =>
        q.eq("accountId", identity.tokenIdentifier).eq("weekStart", weekStart)
      )
      .unique()
    const used = usage?.usedCharacters ?? 0

    return {
      limit: FREE_WEEKLY_CHARACTER_LIMIT,
      used,
      remaining: FREE_WEEKLY_CHARACTER_LIMIT - used,
      resetsAt: weekStart + MILLISECONDS_PER_WEEK,
    }
  },
})

export function startOfUtcWeek(timestamp: number): number {
  const date = new Date(timestamp)
  const daysSinceMonday = (date.getUTCDay() + 6) % 7
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() - daysSinceMonday
  )
}

function validateCharacterCount(characters: number): void {
  if (!Number.isSafeInteger(characters) || characters <= 0) {
    throw new Error("Character count must be a positive integer")
  }
}
