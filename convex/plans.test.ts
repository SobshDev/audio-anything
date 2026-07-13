import { describe, expect, it } from "vitest"

import { PLAN_LIMITS } from "./plans"

describe("plan limits", () => {
  it("increases both allowances with each paid plan", () => {
    expect(PLAN_LIMITS.premium.llmTokens).toBeGreaterThan(
      PLAN_LIMITS.free.llmTokens
    )
    expect(PLAN_LIMITS.max.llmTokens).toBeGreaterThan(
      PLAN_LIMITS.premium.llmTokens
    )
    expect(PLAN_LIMITS.premium.ttsCharacters).toBeGreaterThan(
      PLAN_LIMITS.free.ttsCharacters
    )
    expect(PLAN_LIMITS.max.ttsCharacters).toBeGreaterThan(
      PLAN_LIMITS.premium.ttsCharacters
    )
  })

  it("uses the reviewed weekly launch allowances", () => {
    expect(PLAN_LIMITS).toEqual({
      free: { llmTokens: 50_000, ttsCharacters: 2_500 },
      premium: { llmTokens: 250_000, ttsCharacters: 25_000 },
      max: { llmTokens: 1_000_000, ttsCharacters: 125_000 },
    })
  })
})
