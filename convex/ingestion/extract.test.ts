// @vitest-environment node

import { describe, expect, it } from "vitest"

import {
  extractPdf,
  groupItemsIntoLines,
  groupLinesIntoParagraphs,
  installPdfGeometryGlobals,
  joinWrappedLine,
  removeDeterministicBoilerplate,
  removeRepeatedPageFurniture,
  removeSuperscriptReferenceLines,
  stitchPageBreakParagraphs,
} from "./extract"
import type { ExtractedBlock } from "./extract"

describe("PDF extraction", () => {
  it("installs geometry support before PDF.js is loaded", async () => {
    const original = globalThis.DOMMatrix
    Reflect.deleteProperty(globalThis, "DOMMatrix")
    await installPdfGeometryGlobals()
    expect(globalThis.DOMMatrix).toBeTypeOf("function")
    globalThis.DOMMatrix = original
  })

  it("groups positioned items in reading order", () => {
    const lines = groupItemsIntoLines(
      [
        { text: "world", x: 45, y: 700, width: 30, height: 12 },
        { text: "Second", x: 10, y: 680, width: 40, height: 12 },
        { text: "Hello", x: 10, y: 700, width: 30, height: 12 },
      ],
      800
    )
    expect(lines.map((line) => line.text)).toEqual(["Hello world", "Second"])
  })

  it("keeps headings separate from smaller body text", () => {
    const paragraphs = groupLinesIntoParagraphs(
      [
        line("Launching Dropbox", 700, 18),
        line("The body begins here and continues normally.", 676, 11),
        line("This is the next wrapped line.", 662, 11),
      ],
      612
    )
    expect(paragraphs.map((paragraph) => paragraph.text)).toEqual([
      "Launching Dropbox",
      "The body begins here and continues normally. This is the next wrapped line.",
    ])
  })

  it("keeps body lines together when a paragraph reaches the bottom margin", () => {
    const paragraphs = groupLinesIntoParagraphs(
      [
        line("A paragraph continues toward the page bottom", 92, 10),
        line("and remains part of the same paragraph.", 79, 10),
      ],
      612
    )
    expect(paragraphs).toHaveLength(1)
  })

  it("drops superscript reference markers without dropping ordinary numbers", () => {
    const lines = removeSuperscriptReferenceLines([
      { ...line("A quotation by Drew Houston", 700, 12), width: 180 },
      { ...line("1", 704, 7), x: 222, width: 4 },
      { ...line("2026", 650, 12), x: 40, width: 28 },
    ])
    expect(lines.map((item) => item.text)).toEqual([
      "A quotation by Drew Houston",
      "2026",
    ])
  })

  it("repairs ordinary word hyphenation but preserves compound words", () => {
    expect(joinWrappedLine("The applica-", "tion works.")).toBe(
      "The application works."
    )
    expect(joinWrappedLine("A well-", "Known pattern")).toBe(
      "A well- Known pattern"
    )
  })

  it("removes repeated margin furniture and changing page numbers", () => {
    const blocks: Array<ExtractedBlock> = []
    for (let page = 1; page <= 5; page += 1) {
      blocks.push(
        block(page, 0.03, "For the exclusive use of Example User, 2026"),
        block(page, 0.5, `Meaningful body content on page ${page}.`),
        block(page, 0.95, String(page))
      )
    }
    const cleaned = removeRepeatedPageFurniture(blocks, 5)
    expect(cleaned.filter((item) => item.action === "removed")).toHaveLength(10)
    expect(
      cleaned.filter((item) => item.action === "kept").map((item) => item.text)
    ).toEqual([
      "Meaningful body content on page 1.",
      "Meaningful body content on page 2.",
      "Meaningful body content on page 3.",
      "Meaningful body content on page 4.",
      "Meaningful body content on page 5.",
    ])
  })

  it("removes alternating running headers seen on opposite pages", () => {
    const blocks = Array.from({ length: 10 }, (_, index) =>
      block(
        index + 1,
        0.06,
        index % 2 === 0
          ? "811-065 Dropbox: It Just Works"
          : "Dropbox: It Just Works 811-065"
      )
    )
    const cleaned = removeRepeatedPageFurniture(blocks, 10)
    expect(cleaned.every((item) => item.action === "removed")).toBe(true)
  })

  it("removes unmistakable first-page publication boilerplate", () => {
    const cleaned = removeDeterministicBoilerplate([
      block(
        1,
        0.85,
        "Copyright © 2014 President and Fellows of Harvard College."
      ),
      block(1, 0.5, "The substantive case discussion begins here."),
    ])
    expect(cleaned[0]).toMatchObject({
      action: "removed",
      reason: "publication_boilerplate",
    })
    expect(cleaned[1].action).toBe("kept")
  })

  it("stitches a lowercase sentence continuation across page furniture", () => {
    const stitched = stitchPageBreakParagraphs([
      block(1, 0.85, "The sentence continues onto the next"),
      { ...block(1, 0.95, "1"), action: "removed", reason: "page_number" },
      {
        ...block(2, 0.05, "Running header"),
        action: "removed",
        reason: "repeated_page_furniture",
      },
      block(2, 0.15, "page without an artificial paragraph break."),
    ])
    expect(stitched.filter((item) => item.action === "kept")).toEqual([
      expect.objectContaining({
        pageStart: 1,
        pageEnd: 2,
        text: "The sentence continues onto the next page without an artificial paragraph break.",
      }),
    ])
  })

  it("extracts a synthetic multi-page PDF with a selectable text layer", async () => {
    const result = await extractPdf(
      buildPdf([
        ["Repeated header", "First page body has enough readable text.", "1"],
        ["Repeated header", "Second page body has enough readable text.", "2"],
        ["Repeated header", "Third page body has enough readable text.", "3"],
      ])
    )
    expect(result.pageCount).toBe(3)
    expect(
      result.blocks.some((item) => item.text.includes("First page body"))
    ).toBe(true)
    expect(
      result.blocks.filter(
        (item) =>
          item.text === "Repeated header" &&
          item.reason === "repeated_page_furniture"
      )
    ).toHaveLength(3)
  })

  it("rejects PDFs without a readable text layer", async () => {
    await expect(extractPdf(buildPdf([[]]))).rejects.toThrow(
      "Scanned PDFs are not supported yet"
    )
  })
})

function block(page: number, topRatio: number, text: string): ExtractedBlock {
  return {
    id: `${page}-${text}`,
    order: page,
    pageStart: page,
    pageEnd: page,
    text,
    topRatio,
    action: "kept",
  }
}

function line(text: string, y: number, height: number) {
  return {
    text,
    x: 40,
    y,
    width: 300,
    height,
    topRatio: Math.max(0, (792 - y) / 792),
  }
}

function buildPdf(pages: Array<Array<string>>): Uint8Array {
  const objects: Array<string> = []
  const add = (value: string) => {
    objects.push(value)
    return objects.length
  }
  const catalogId = add("")
  const pagesId = add("")
  const fontId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
  const pageIds: Array<number> = []

  for (const lines of pages) {
    const commands = lines
      .map((line, index) => {
        const y =
          index === 0 ? 760 : index === lines.length - 1 ? 30 : 700 - index * 30
        return `BT /F1 12 Tf 40 ${y} Td (${escapePdf(line)}) Tj ET`
      })
      .join("\n")
    const contentId = add(
      `<< /Length ${commands.length} >>\nstream\n${commands}\nendstream`
    )
    pageIds.push(
      add(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`
      )
    )
  }
  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`
  objects[pagesId - 1] =
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`

  let output = "%PDF-1.4\n"
  const offsets = [0]
  objects.forEach((object, index) => {
    offsets.push(output.length)
    output += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xref = output.length
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  output += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("")
  output += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`
  return new TextEncoder().encode(output)
}

function escapePdf(text: string) {
  return text
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)")
}
