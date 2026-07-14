import { describe, expect, it } from "vitest"

import {
  createDialogueBatches,
  extractSpeakerTurns,
  shouldUseDialogue,
} from "./document"

describe("document audio", () => {
  it("keeps named speakers on distinct turns", () => {
    expect(
      extractSpeakerTurns([
        "Introduction",
        "Alice: Hello there.\nBob: Good morning.\nAlice: Shall we begin?",
      ])
    ).toEqual([
      { speaker: "Narrator", text: "Introduction" },
      { speaker: "Alice", text: "Hello there." },
      { speaker: "Bob", text: "Good morning." },
      { speaker: "Alice", text: "Shall we begin?" },
    ])
  })

  it("splits dialogue without exceeding the provider limit", () => {
    const batches = createDialogueBatches([
      { speaker: "Narrator", text: "Sentence. ".repeat(500) },
    ])
    expect(batches.length).toBeGreaterThan(1)
    expect(
      batches.every(
        (batch) =>
          batch.reduce((total, turn) => total + turn.text.length, 0) <= 2_000
      )
    ).toBe(true)
  })

  it("uses standard TTS for narrator-only batches", () => {
    expect(
      shouldUseDialogue([{ speaker: "Narrator", text: "A document." }])
    ).toBe(false)
    expect(
      shouldUseDialogue([
        { speaker: "Alice", text: "Hello." },
        { speaker: "Bob", text: "Hi." },
      ])
    ).toBe(true)
  })
})
