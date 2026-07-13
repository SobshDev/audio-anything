// @vitest-environment jsdom

import { describe, expect, it } from "vitest"

import { validatePdf } from "./add-document"

describe("PDF upload validation", () => {
  it("accepts a non-empty PDF under 25 MB", () => {
    expect(
      validatePdf({ name: "report.pdf", size: 1024, type: "application/pdf" })
    ).toBeNull()
  })

  it("rejects unsupported, empty, and oversized files", () => {
    expect(
      validatePdf({ name: "notes.txt", size: 10, type: "text/plain" })
    ).toBe("Only PDF files are supported")
    expect(
      validatePdf({ name: "empty.pdf", size: 0, type: "application/pdf" })
    ).toBe("The selected PDF is empty")
    expect(
      validatePdf({
        name: "large.pdf",
        size: 25 * 1024 * 1024 + 1,
        type: "application/pdf",
      })
    ).toBe("PDF files must be 25 MB or smaller")
  })
})
