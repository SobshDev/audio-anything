import { describe, expect, it } from "vitest"

import { startOfUtcWeek } from "./usage"

describe("startOfUtcWeek", () => {
  it("uses Monday at midnight UTC as the weekly boundary", () => {
    expect(startOfUtcWeek(Date.parse("2026-07-13T18:30:00Z"))).toBe(
      Date.parse("2026-07-13T00:00:00Z")
    )
    expect(startOfUtcWeek(Date.parse("2026-07-19T23:59:59Z"))).toBe(
      Date.parse("2026-07-13T00:00:00Z")
    )
    expect(startOfUtcWeek(Date.parse("2026-07-20T00:00:00Z"))).toBe(
      Date.parse("2026-07-20T00:00:00Z")
    )
  })
})
