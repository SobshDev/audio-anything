import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

import { planValidator } from "./plans"

export default defineSchema({
  accounts: defineTable({
    accountId: v.string(),
    plan: planValidator,
  }).index("by_accountId", ["accountId"]),
  weeklyTtsUsage: defineTable({
    accountId: v.string(),
    weekStart: v.number(),
    usedCharacters: v.number(),
  }).index("by_accountId_and_weekStart", ["accountId", "weekStart"]),
  weeklyLlmUsage: defineTable({
    accountId: v.string(),
    weekStart: v.number(),
    usedTokens: v.number(),
  }).index("by_accountId_and_weekStart", ["accountId", "weekStart"]),
})
