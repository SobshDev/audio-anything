import type { ExtractedBlock } from "./extract"

export const INGESTION_MODEL = "openai/gpt-5-nano"
export const MAX_BATCH_CHARACTERS = 12_000
export const REMOVE_CONFIDENCE = 0.9

export type ClassificationLabel =
  "keep" | "remove_boilerplate" | "remove_navigation" | "review"

export type Classification = {
  id: string
  label: ClassificationLabel
  confidence: number
}

export function createClassificationBatches(
  blocks: Array<ExtractedBlock>,
  maxCharacters = MAX_BATCH_CHARACTERS
): Array<Array<ExtractedBlock>> {
  const batches: Array<Array<ExtractedBlock>> = []
  let current: Array<ExtractedBlock> = []
  let currentSize = 0

  for (const block of blocks.filter((item) => item.action === "kept")) {
    const size = block.text.length + block.id.length + 30
    if (size > maxCharacters) continue
    if (current.length > 0 && currentSize + size > maxCharacters) {
      batches.push(current)
      current = []
      currentSize = 0
    }
    current.push(block)
    currentSize += size
  }
  if (current.length > 0) batches.push(current)
  return batches
}

export function buildClassificationPrompt(
  blocks: Array<ExtractedBlock>
): string {
  return JSON.stringify(
    blocks.map((block) => ({
      id: block.id,
      page: block.pageStart,
      text: block.text,
    }))
  )
}

export function applyClassifications(
  blocks: Array<ExtractedBlock>,
  classifications: Array<Classification>
): Array<ExtractedBlock> {
  const byId = new Map(classifications.map((item) => [item.id, item]))
  return blocks.map((block) => {
    if (block.action === "removed") return block
    const result = byId.get(block.id)
    if (
      !result ||
      result.confidence < REMOVE_CONFIDENCE ||
      (result.label !== "remove_boilerplate" &&
        result.label !== "remove_navigation")
    ) {
      return block
    }
    return {
      ...block,
      action: "removed",
      reason: result.label,
      confidence: result.confidence,
    }
  })
}

export function parseClassificationResponse(
  content: string,
  allowedIds: Set<string>
): Array<Classification> | null {
  try {
    const parsed = JSON.parse(content) as unknown
    if (!parsed || typeof parsed !== "object" || !("decisions" in parsed)) {
      return null
    }
    const decisions = parsed.decisions
    if (!Array.isArray(decisions)) return null
    const results: Array<Classification> = []
    for (const decision of decisions) {
      if (!decision || typeof decision !== "object") return null
      const value = decision as Record<string, unknown>
      if (
        typeof value.id !== "string" ||
        !allowedIds.has(value.id) ||
        !isLabel(value.label) ||
        typeof value.confidence !== "number" ||
        value.confidence < 0 ||
        value.confidence > 1
      ) {
        return null
      }
      results.push({
        id: value.id,
        label: value.label,
        confidence: value.confidence,
      })
    }
    return results
  } catch {
    return null
  }
}

function isLabel(value: unknown): value is ClassificationLabel {
  return (
    value === "keep" ||
    value === "remove_boilerplate" ||
    value === "remove_navigation" ||
    value === "review"
  )
}
