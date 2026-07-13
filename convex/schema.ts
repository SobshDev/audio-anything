import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

import { planValidator } from "./plans"

const documentStatusValidator = v.union(
  v.literal("queued"),
  v.literal("processing"),
  v.literal("ready"),
  v.literal("failed")
)

const documentBlockActionValidator = v.union(
  v.literal("kept"),
  v.literal("removed")
)

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
  documents: defineTable({
    ownerId: v.string(),
    originalStorageId: v.id("_storage"),
    filename: v.string(),
    mimeType: v.string(),
    byteSize: v.number(),
    status: documentStatusValidator,
    progress: v.number(),
    pageCount: v.optional(v.number()),
    blockCount: v.optional(v.number()),
    keptBlockCount: v.optional(v.number()),
    removedBlockCount: v.optional(v.number()),
    error: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_ownerId", ["ownerId"])
    .index("by_ownerId_and_updatedAt", ["ownerId", "updatedAt"]),
  documentBlocks: defineTable({
    documentId: v.id("documents"),
    order: v.number(),
    pageStart: v.number(),
    pageEnd: v.number(),
    text: v.string(),
    action: documentBlockActionValidator,
    reason: v.optional(v.string()),
    confidence: v.optional(v.number()),
  })
    .index("by_documentId_and_order", ["documentId", "order"])
    .index("by_documentId_and_action_and_order", [
      "documentId",
      "action",
      "order",
    ]),
})
