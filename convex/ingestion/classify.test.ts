import { describe, expect, it } from "vitest"

import {
  applyClassifications,
  createClassificationBatches,
  parseClassificationResponse,
} from "./classify"
import type { ExtractedBlock } from "./extract"

describe("block classification", () => {
  it("batches under the configured character limit", () => {
    const blocks = [
      makeBlock("a", "a".repeat(70)),
      makeBlock("b", "b".repeat(70)),
    ]
    expect(createClassificationBatches(blocks, 120)).toHaveLength(2)
  })

  it("keeps unknown, review, and low-confidence decisions", () => {
    const blocks = [makeBlock("a", "Body"), makeBlock("b", "Copyright notice")]
    const result = applyClassifications(blocks, [
      { id: "a", label: "review", confidence: 1 },
      { id: "b", label: "remove_boilerplate", confidence: 0.89 },
    ])
    expect(result.every((block) => block.action === "kept")).toBe(true)
  })

  it("removes only confident explicit removal labels", () => {
    const result = applyClassifications(
      [makeBlock("a", "Copyright notice")],
      [{ id: "a", label: "remove_boilerplate", confidence: 0.98 }]
    )
    expect(result[0]).toMatchObject({
      action: "removed",
      reason: "remove_boilerplate",
      confidence: 0.98,
    })
  })

  it("rejects malformed or unexpected structured responses", () => {
    expect(parseClassificationResponse("not json", new Set(["a"]))).toBeNull()
    expect(
      parseClassificationResponse(
        JSON.stringify({
          decisions: [{ id: "unknown", label: "keep", confidence: 1 }],
        }),
        new Set(["a"])
      )
    ).toBeNull()
  })
})

function makeBlock(id: string, text: string): ExtractedBlock {
  return {
    id,
    order: 0,
    pageStart: 1,
    pageEnd: 1,
    text,
    topRatio: 0.5,
    action: "kept",
  }
}
