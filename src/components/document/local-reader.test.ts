import { describe, expect, it } from "vitest"

import { createLocalTurns } from "./local-reader"

describe("local reader", () => {
  it("assigns consistent local voices to speakers", () => {
    const turns = createLocalTurns([
      "Alice: Hello there.\nBob: Good morning.\nAlice: Welcome back.",
    ])
    expect(turns[0].voice).toBe(turns[2].voice)
    expect(turns[0].voice).not.toBe(turns[1].voice)
  })

  it("splits long passages into model-friendly chunks", () => {
    const turns = createLocalTurns(["Sentence. ".repeat(100)])
    expect(turns.length).toBeGreaterThan(1)
    expect(turns.every((turn) => turn.text.length <= 420)).toBe(true)
  })
})
