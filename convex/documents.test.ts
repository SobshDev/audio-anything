/// <reference types="vite/client" />

import { convexTest } from "convex-test"
import { describe, expect, it } from "vitest"

import { api, internal } from "./_generated/api"
import schema from "./schema"

const modules = import.meta.glob("./**/*.ts")

describe("documents", () => {
  it("requires authentication", async () => {
    const t = convexTest(schema, modules)
    await expect(t.query(api.documents.listMine, {})).rejects.toThrow(
      "Authentication required"
    )
  })

  it("only returns documents owned by the current identity", async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(
        new Blob(["%PDF-1.4"], { type: "application/pdf" })
      )
      await ctx.db.insert("documents", {
        ownerId: "user-a",
        originalStorageId: storageId,
        filename: "a.pdf",
        mimeType: "application/pdf",
        byteSize: 8,
        status: "ready",
        progress: 100,
        updatedAt: Date.now(),
      })
      await ctx.db.insert("documents", {
        ownerId: "user-b",
        originalStorageId: storageId,
        filename: "b.pdf",
        mimeType: "application/pdf",
        byteSize: 8,
        status: "ready",
        progress: 100,
        updatedAt: Date.now(),
      })
    })

    const asUserA = t.withIdentity({ tokenIdentifier: "user-a" })
    const documents = await asUserA.query(api.documents.listMine, {})
    expect(documents.map((document) => document.filename)).toEqual(["a.pdf"])
  })

  it("records processing, failure, and completion states", async () => {
    const t = convexTest(schema, modules)
    const documentId = await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(
        new Blob(["%PDF-1.4"], { type: "application/pdf" })
      )
      return await ctx.db.insert("documents", {
        ownerId: "user-a",
        originalStorageId: storageId,
        filename: "states.pdf",
        mimeType: "application/pdf",
        byteSize: 8,
        status: "queued",
        progress: 0,
        updatedAt: Date.now(),
      })
    })

    await t.mutation(internal.documents.beginProcessing, { documentId })
    await t.mutation(internal.documents.failProcessing, {
      documentId,
      error: "Malformed PDF",
    })
    expect(
      await t.run(async (ctx) => await ctx.db.get("documents", documentId))
    ).toMatchObject({ status: "failed", error: "Malformed PDF" })

    await t.mutation(internal.documents.completeProcessing, {
      documentId,
      pageCount: 3,
      blockCount: 10,
      keptBlockCount: 8,
      removedBlockCount: 2,
    })
    expect(
      await t.run(async (ctx) => await ctx.db.get("documents", documentId))
    ).toMatchObject({
      status: "ready",
      progress: 100,
      pageCount: 3,
      keptBlockCount: 8,
      removedBlockCount: 2,
    })
  })
})
