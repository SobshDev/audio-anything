"use node"

export type ExtractedBlock = {
  id: string
  order: number
  pageStart: number
  pageEnd: number
  text: string
  topRatio: number
  action: "kept" | "removed"
  reason?: string
  confidence?: number
}

type PositionedItem = {
  text: string
  x: number
  y: number
  width: number
  height: number
}

type Line = {
  text: string
  x: number
  y: number
  width: number
  height: number
  topRatio: number
}

const MARGIN_RATIO = 0.12
const REPEAT_RATIO = 0.3

export async function extractPdf(data: Uint8Array): Promise<{
  pageCount: number
  blocks: Array<ExtractedBlock>
}> {
  await installPdfGeometryGlobals()
  await installPdfWorker()
  const { getDocument } = await import("pdfjs-dist/build/pdf.mjs")
  const loadingTask = getDocument({ data, useSystemFonts: true })
  const pdf = await loadingTask.promise
  const blocks: Array<ExtractedBlock> = []

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      const viewport = page.getViewport({ scale: 1 })
      const content = await page.getTextContent()
      const items: Array<PositionedItem> = []

      for (const item of content.items) {
        if (!("str" in item) || !item.str.trim()) continue
        items.push({
          text: item.str.trim(),
          x: item.transform[4],
          y: item.transform[5],
          width: item.width,
          height: Math.max(item.height, Math.abs(item.transform[3]), 1),
        })
      }

      const lines = removeSuperscriptReferenceLines(
        groupItemsIntoLines(items, viewport.height)
      )
      const paragraphs = groupLinesIntoParagraphs(lines, viewport.width)
      for (const paragraph of paragraphs) {
        blocks.push({
          id: `p${pageNumber}-b${blocks.length}`,
          order: blocks.length,
          pageStart: pageNumber,
          pageEnd: pageNumber,
          text: paragraph.text,
          topRatio: paragraph.topRatio,
          action: "kept",
        })
      }
    }
  } finally {
    await loadingTask.destroy()
  }

  if (!blocks.some((block) => block.text.trim().length >= 20)) {
    throw new Error(
      "No readable text was found. Scanned PDFs are not supported yet."
    )
  }

  return {
    pageCount: pdf.numPages,
    blocks: stitchPageBreakParagraphs(
      removeDeterministicBoilerplate(
        removeRepeatedPageFurniture(blocks, pdf.numPages)
      )
    ),
  }
}

async function installPdfWorker(): Promise<void> {
  const scope = globalThis as typeof globalThis & {
    pdfjsWorker?: { WorkerMessageHandler: unknown }
  }
  const { WorkerMessageHandler } =
    await import("pdfjs-dist/build/pdf.worker.mjs")
  scope.pdfjsWorker = { WorkerMessageHandler }
}

export async function installPdfGeometryGlobals(): Promise<void> {
  if (globalThis.DOMMatrix) return
  const geometry = await import("@napi-rs/canvas/geometry.js")
  const DOMMatrixImplementation =
    geometry.DOMMatrix ?? geometry.default?.DOMMatrix
  if (!DOMMatrixImplementation) {
    throw new Error("PDF geometry support could not be loaded")
  }
  globalThis.DOMMatrix = DOMMatrixImplementation
}

export function groupItemsIntoLines(
  items: Array<PositionedItem>,
  pageHeight: number
): Array<Line> {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x)
  const groups: Array<Array<PositionedItem>> = []

  for (const item of sorted) {
    const group = groups.find(
      (candidate) =>
        Math.abs(candidate[0].y - item.y) <=
        Math.max(2.5, Math.min(candidate[0].height, item.height) * 0.35)
    )
    if (group) group.push(item)
    else groups.push([item])
  }

  return groups
    .map((group) => {
      group.sort((a, b) => a.x - b.x)
      let text = ""
      let previousEnd = 0
      for (const item of group) {
        const needsSpace =
          text.length > 0 &&
          item.x - previousEnd > Math.max(1.5, item.height * 0.12)
        text += `${needsSpace ? " " : ""}${item.text}`
        previousEnd = item.x + item.width
      }
      const x = Math.min(...group.map((item) => item.x))
      const end = Math.max(...group.map((item) => item.x + item.width))
      const y = group.reduce((sum, item) => sum + item.y, 0) / group.length
      const height = Math.max(...group.map((item) => item.height))
      return {
        text: normalizeWhitespace(text),
        x,
        y,
        width: end - x,
        height,
        topRatio: Math.max(0, Math.min(1, (pageHeight - y) / pageHeight)),
      }
    })
    .filter((line) => line.text.length > 0)
    .sort((a, b) => b.y - a.y || a.x - b.x)
}

export function groupLinesIntoParagraphs(
  lines: Array<Line>,
  pageWidth: number
): Array<{ text: string; topRatio: number }> {
  const paragraphs: Array<{ lines: Array<Line>; topRatio: number }> = []

  for (const line of lines) {
    const previous = paragraphs.at(-1)
    const previousLine = previous?.lines.at(-1)
    const verticalGap = previousLine
      ? previousLine.y - line.y - previousLine.height
      : Number.POSITIVE_INFINITY
    const startsNewParagraph =
      !previousLine ||
      verticalGap > Math.max(previousLine.height, line.height) * 0.8 ||
      Math.abs(previousLine.x - line.x) > pageWidth * 0.08 ||
      line.height > previousLine.height * 1.25 ||
      previousLine.height > line.height * 1.25

    if (startsNewParagraph) {
      paragraphs.push({ lines: [line], topRatio: line.topRatio })
    } else if (previous) {
      previous.lines.push(line)
    }
  }

  return paragraphs.map((paragraph) => ({
    topRatio: paragraph.topRatio,
    text: paragraph.lines.reduce(
      (text, line) => joinWrappedLine(text, line.text),
      ""
    ),
  }))
}

export function joinWrappedLine(current: string, next: string): string {
  if (!current) return next
  if (/\p{L}-$/u.test(current) && /^\p{Ll}/u.test(next)) {
    return `${current.slice(0, -1)}${next}`
  }
  return `${current} ${next}`
}

export function removeRepeatedPageFurniture(
  blocks: Array<ExtractedBlock>,
  pageCount: number
): Array<ExtractedBlock> {
  const occurrences = new Map<string, Set<number>>()
  for (const block of blocks) {
    if (!isMarginBlock(block)) continue
    const normalized = normalizeForRepeat(block.text)
    if (!normalized) continue
    const pages = occurrences.get(normalized) ?? new Set<number>()
    pages.add(block.pageStart)
    occurrences.set(normalized, pages)
  }

  const minimumPages = Math.max(3, Math.ceil(pageCount * REPEAT_RATIO))
  return blocks.map((block) => {
    if (isStandalonePageNumber(block.text) && isMarginBlock(block)) {
      return {
        ...block,
        action: "removed",
        reason: "page_number",
        confidence: 1,
      }
    }
    const count = occurrences.get(normalizeForRepeat(block.text))?.size ?? 0
    if (isMarginBlock(block) && count >= minimumPages) {
      return {
        ...block,
        action: "removed",
        reason: "repeated_page_furniture",
        confidence: 1,
      }
    }
    return block
  })
}

export function removeSuperscriptReferenceLines(
  lines: Array<Line>
): Array<Line> {
  if (lines.length < 2) return lines
  const ordinaryHeights = lines
    .filter((line) => !/^\d{1,2}$/.test(line.text))
    .map((line) => line.height)
    .sort((a, b) => a - b)
  const medianHeight =
    ordinaryHeights[Math.floor(ordinaryHeights.length / 2)] ?? 0

  return lines.filter((line) => {
    if (!/^\d{1,2}$/.test(line.text) || line.height > medianHeight * 0.8) {
      return true
    }
    return !lines.some((candidate) => {
      if (candidate === line || /^\d{1,2}$/.test(candidate.text)) return false
      const candidateEnd = candidate.x + candidate.width
      return (
        Math.abs(candidate.y - line.y) <= medianHeight * 1.1 &&
        line.x >= candidate.x - medianHeight * 0.5 &&
        line.x <= candidateEnd + medianHeight * 1.5
      )
    })
  })
}

export function removeDeterministicBoilerplate(
  blocks: Array<ExtractedBlock>
): Array<ExtractedBlock> {
  const firstPageDividerOrder = blocks.find(
    (block) => block.pageStart === 1 && /^[_\-–—]{8,}$/.test(block.text.trim())
  )?.order

  return blocks.map((block) => {
    if (block.action === "removed") return block
    const text = block.text.trim()
    const isDivider = /^[_\-–—]{8,}$/.test(text)
    const isBelowFirstPageDivider =
      firstPageDividerOrder !== undefined &&
      block.pageStart === 1 &&
      block.order >= firstPageDividerOrder
    const isPublicationBoilerplate =
      block.pageStart === 1 &&
      (/(?:prepared this case|cases are developed solely)/i.test(text) ||
        /^(?:copyright|©)\b/i.test(text) ||
        /(?:to order copies|request permission to reproduce|may not be digitized|without the permission of)/i.test(
          text
        ))
    const compactText = text.replace(/\s+/g, "")
    const isRevisionMetadata =
      block.pageStart === 1 &&
      (/rev:[a-z]+\d/i.test(compactText) || /^[\d\s-]{5,}$/.test(text))

    if (
      !isDivider &&
      !isBelowFirstPageDivider &&
      !isPublicationBoilerplate &&
      !isRevisionMetadata
    ) {
      return block
    }
    return {
      ...block,
      action: "removed",
      reason: isDivider ? "decorative_divider" : "publication_boilerplate",
      confidence: 1,
    }
  })
}

export function stitchPageBreakParagraphs(
  blocks: Array<ExtractedBlock>
): Array<ExtractedBlock> {
  const result = [...blocks]
  const removedIndexes = new Set<number>()
  let previousKeptIndex: number | null = null

  for (let index = 0; index < result.length; index += 1) {
    const block = result[index]
    if (block.action === "removed") continue
    if (previousKeptIndex !== null) {
      const previous = result[previousKeptIndex]
      const crossesOnePage = block.pageStart === previous.pageEnd + 1
      const previousContinues = !/[.!?:;”"')\]]$/.test(previous.text.trim())
      const nextContinues = /^\p{Ll}/u.test(block.text.trim())
      if (crossesOnePage && previousContinues && nextContinues) {
        result[previousKeptIndex] = {
          ...previous,
          pageEnd: block.pageEnd,
          text: joinWrappedLine(previous.text, block.text),
        }
        removedIndexes.add(index)
        continue
      }
    }
    previousKeptIndex = index
  }

  return result
    .filter((_, index) => !removedIndexes.has(index))
    .map((block, order) => ({ ...block, order }))
}

function isMarginBlock(block: ExtractedBlock): boolean {
  return block.topRatio <= MARGIN_RATIO || block.topRatio >= 1 - MARGIN_RATIO
}

function isStandalonePageNumber(text: string): boolean {
  return /^(?:page\s+)?-?\s*\d{1,4}\s*-?$/i.test(text.trim())
}

function normalizeForRepeat(text: string): string {
  return normalizeWhitespace(text.normalize("NFKC").toLowerCase())
    .replace(/\d+/g, "#")
    .replace(/[^\p{L}#]+/gu, " ")
    .trim()
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim()
}
