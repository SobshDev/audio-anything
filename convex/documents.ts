import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server"
import { v } from "convex/values"

import { internal } from "./_generated/api"
import type { Doc, Id } from "./_generated/dataModel"
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server"

const MAX_FILE_SIZE = 25 * 1024 * 1024
const DELETE_BATCH_SIZE = 100

const blockActionValidator = v.union(v.literal("kept"), v.literal("removed"))

const blockValidator = v.object({
  _id: v.id("documentBlocks"),
  _creationTime: v.number(),
  documentId: v.id("documents"),
  order: v.number(),
  pageStart: v.number(),
  pageEnd: v.number(),
  text: v.string(),
  action: blockActionValidator,
  reason: v.optional(v.string()),
  confidence: v.optional(v.number()),
})

async function requireIdentity(ctx: {
  auth: { getUserIdentity: () => Promise<{ tokenIdentifier: string } | null> }
}) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new Error("Authentication required")
  return identity
}

export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireIdentity(ctx)
    return await ctx.storage.generateUploadUrl()
  },
})

export const startIngestion = mutation({
  args: {
    storageId: v.id("_storage"),
    filename: v.string(),
  },
  returns: v.id("documents"),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const metadata = await ctx.db.system.get("_storage", args.storageId)
    if (!metadata) throw new Error("Uploaded file was not found")
    if (metadata.contentType !== "application/pdf") {
      await ctx.storage.delete(args.storageId)
      throw new Error("Only PDF files are supported")
    }
    if (metadata.size > MAX_FILE_SIZE) {
      await ctx.storage.delete(args.storageId)
      throw new Error("PDF files must be 25 MB or smaller")
    }

    const filename = args.filename.trim()
    if (!filename) throw new Error("Filename is required")
    const now = Date.now()
    const documentId = await ctx.db.insert("documents", {
      ownerId: identity.tokenIdentifier,
      originalStorageId: args.storageId,
      filename,
      mimeType: metadata.contentType,
      byteSize: metadata.size,
      status: "queued",
      progress: 0,
      updatedAt: now,
    })
    await ctx.scheduler.runAfter(0, internal.ingestion.process.run, {
      documentId,
    })
    return documentId
  },
})

export const listMine = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx)
    return await ctx.db
      .query("documents")
      .withIndex("by_ownerId_and_updatedAt", (q) =>
        q.eq("ownerId", identity.tokenIdentifier)
      )
      .order("desc")
      .take(50)
  },
})

export const getMine = query({
  args: { documentId: v.id("documents") },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const document = await ctx.db.get("documents", args.documentId)
    return document?.ownerId === identity.tokenIdentifier ? document : null
  },
})

export const listBlocks = query({
  args: {
    documentId: v.id("documents"),
    action: blockActionValidator,
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(blockValidator),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const document = await ctx.db.get("documents", args.documentId)
    if (!document || document.ownerId !== identity.tokenIdentifier) {
      throw new Error("Document not found")
    }
    return await ctx.db
      .query("documentBlocks")
      .withIndex("by_documentId_and_action_and_order", (q) =>
        q.eq("documentId", args.documentId).eq("action", args.action)
      )
      .paginate(args.paginationOpts)
  },
})

export const retry = mutation({
  args: { documentId: v.id("documents") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const document = await ctx.db.get("documents", args.documentId)
    if (!document || document.ownerId !== identity.tokenIdentifier) {
      throw new Error("Document not found")
    }
    const isStaleProcessing =
      document.status === "processing" &&
      Date.now() - document.updatedAt >= 60_000
    if (
      document.status !== "failed" &&
      document.status !== "ready" &&
      !isStaleProcessing
    ) {
      throw new Error(
        "Only ready, failed, or stalled documents can be reprocessed"
      )
    }
    await ctx.db.patch("documents", args.documentId, {
      status: "queued",
      progress: 0,
      error: undefined,
      updatedAt: Date.now(),
    })
    await ctx.scheduler.runAfter(0, internal.ingestion.process.run, {
      documentId: args.documentId,
    })
    return null
  },
})

export const remove = mutation({
  args: { documentId: v.id("documents") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const document = await ctx.db.get("documents", args.documentId)
    if (!document || document.ownerId !== identity.tokenIdentifier) {
      throw new Error("Document not found")
    }
    await ctx.db.delete("documents", args.documentId)
    await ctx.scheduler.runAfter(0, internal.documents.deleteArtifacts, {
      documentId: args.documentId,
      storageId: document.originalStorageId,
      deleteStorage: true,
    })
    return null
  },
})

export const getForProcessing = internalQuery({
  args: { documentId: v.id("documents") },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => await ctx.db.get("documents", args.documentId),
})

export const beginProcessing = internalMutation({
  args: { documentId: v.id("documents") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const document = await ctx.db.get("documents", args.documentId)
    if (!document) return null
    await ctx.db.patch("documents", args.documentId, {
      status: "processing",
      progress: 5,
      error: undefined,
      startedAt: Date.now(),
      completedAt: undefined,
      updatedAt: Date.now(),
    })
    return null
  },
})

export const setProgress = internalMutation({
  args: {
    documentId: v.id("documents"),
    progress: v.number(),
    pageCount: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const document = await ctx.db.get("documents", args.documentId)
    if (!document) return null
    await ctx.db.patch("documents", args.documentId, {
      progress: Math.max(0, Math.min(100, args.progress)),
      ...(args.pageCount === undefined ? {} : { pageCount: args.pageCount }),
      updatedAt: Date.now(),
    })
    return null
  },
})

export const insertBlocks = internalMutation({
  args: {
    documentId: v.id("documents"),
    blocks: v.array(
      v.object({
        order: v.number(),
        pageStart: v.number(),
        pageEnd: v.number(),
        text: v.string(),
        action: blockActionValidator,
        reason: v.optional(v.string()),
        confidence: v.optional(v.number()),
      })
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!(await ctx.db.get("documents", args.documentId))) return null
    for (const block of args.blocks) {
      await ctx.db.insert("documentBlocks", {
        documentId: args.documentId,
        ...block,
      })
    }
    return null
  },
})

export const clearBlocks = internalMutation({
  args: { documentId: v.id("documents") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const blocks = await ctx.db
      .query("documentBlocks")
      .withIndex("by_documentId_and_order", (q) =>
        q.eq("documentId", args.documentId)
      )
      .take(DELETE_BATCH_SIZE)
    for (const block of blocks) await ctx.db.delete("documentBlocks", block._id)
    return blocks.length === DELETE_BATCH_SIZE
  },
})

export const completeProcessing = internalMutation({
  args: {
    documentId: v.id("documents"),
    pageCount: v.number(),
    blockCount: v.number(),
    keptBlockCount: v.number(),
    removedBlockCount: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const document = await ctx.db.get("documents", args.documentId)
    if (!document) return null
    await ctx.db.patch("documents", args.documentId, {
      status: "ready",
      progress: 100,
      pageCount: args.pageCount,
      blockCount: args.blockCount,
      keptBlockCount: args.keptBlockCount,
      removedBlockCount: args.removedBlockCount,
      completedAt: Date.now(),
      updatedAt: Date.now(),
    })
    return null
  },
})

export const failProcessing = internalMutation({
  args: { documentId: v.id("documents"), error: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const document = await ctx.db.get("documents", args.documentId)
    if (!document) return null
    await ctx.db.patch("documents", args.documentId, {
      status: "failed",
      error: args.error,
      updatedAt: Date.now(),
    })
    return null
  },
})

export const deleteArtifacts = internalMutation({
  args: {
    documentId: v.id("documents"),
    storageId: v.id("_storage"),
    deleteStorage: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const blocks = await ctx.db
      .query("documentBlocks")
      .withIndex("by_documentId_and_order", (q) =>
        q.eq("documentId", args.documentId)
      )
      .take(DELETE_BATCH_SIZE)
    for (const block of blocks) await ctx.db.delete("documentBlocks", block._id)
    if (blocks.length === DELETE_BATCH_SIZE) {
      await ctx.scheduler.runAfter(0, internal.documents.deleteArtifacts, args)
    } else if (args.deleteStorage) {
      await ctx.storage.delete(args.storageId)
    }
    return null
  },
})

export type ProcessableDocument = Doc<"documents">
export type DocumentId = Id<"documents">
