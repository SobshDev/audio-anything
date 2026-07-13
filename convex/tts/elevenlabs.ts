import type {
  AudioFormat,
  SynthesizeSpeechInput,
  SynthesizedSpeech,
  TextToSpeechProvider,
  VoiceSettings,
} from "./types"

const DEFAULT_BASE_URL = "https://api.elevenlabs.io"
const DEFAULT_MODEL_ID = "eleven_multilingual_v2"
const DEFAULT_OUTPUT_FORMAT: AudioFormat = "mp3_44100_128"
const MULTILINGUAL_V2_CHARACTER_LIMIT = 10_000

type Fetch = typeof fetch

export type ElevenLabsProviderOptions = {
  apiKey: string
  baseUrl?: string
  fetch?: Fetch
}

export type ElevenLabsVoice = {
  voiceId: string
  name: string
  category: string
  description: string | null
  previewUrl: string | null
  labels: Record<string, string>
}

export type ElevenLabsModel = {
  modelId: string
  name: string
  canDoTextToSpeech: boolean
  maximumTextLengthPerRequest: number
  languages: Array<{ languageId: string; name: string }>
}

export class ElevenLabsApiError extends Error {
  readonly status: number
  readonly details: unknown

  constructor(status: number, message: string, details: unknown) {
    super(message)
    this.name = "ElevenLabsApiError"
    this.status = status
    this.details = details
  }
}

export class ElevenLabsProvider implements TextToSpeechProvider {
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly fetch: Fetch

  constructor(options: ElevenLabsProviderOptions) {
    if (!options.apiKey.trim()) {
      throw new Error("ElevenLabs API key is required")
    }

    this.apiKey = options.apiKey
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "")
    this.fetch = options.fetch ?? globalThis.fetch
  }

  async synthesize(input: SynthesizeSpeechInput): Promise<SynthesizedSpeech> {
    validateSynthesisInput(input)

    const modelId = input.modelId ?? DEFAULT_MODEL_ID
    if (
      modelId === DEFAULT_MODEL_ID &&
      input.text.length > MULTILINGUAL_V2_CHARACTER_LIMIT
    ) {
      throw new Error(
        `ElevenLabs ${DEFAULT_MODEL_ID} accepts at most ${MULTILINGUAL_V2_CHARACTER_LIMIT} characters per request`
      )
    }

    const outputFormat = input.outputFormat ?? DEFAULT_OUTPUT_FORMAT
    const url = new URL(
      `/v1/text-to-speech/${encodeURIComponent(input.voiceId)}`,
      this.baseUrl
    )
    url.searchParams.set("output_format", outputFormat)

    const response = await this.fetch(url, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        text: input.text,
        model_id: modelId,
        ...(input.languageCode ? { language_code: input.languageCode } : {}),
        ...(input.voiceSettings
          ? { voice_settings: toApiVoiceSettings(input.voiceSettings) }
          : {}),
        ...(input.seed === undefined ? {} : { seed: input.seed }),
        ...(input.previousText ? { previous_text: input.previousText } : {}),
        ...(input.nextText ? { next_text: input.nextText } : {}),
        ...(input.previousRequestIds?.length
          ? { previous_request_ids: input.previousRequestIds }
          : {}),
        ...(input.nextRequestIds?.length
          ? { next_request_ids: input.nextRequestIds }
          : {}),
      }),
    })

    if (!response.ok) {
      throw await toApiError(response)
    }

    return {
      audio: await response.blob(),
      contentType:
        response.headers.get("content-type") ?? contentType(outputFormat),
      requestId:
        response.headers.get("request-id") ??
        response.headers.get("x-request-id"),
    }
  }

  async synthesizeSegments(
    input: Omit<SynthesizeSpeechInput, "text" | "previousText" | "nextText"> & {
      segments: Array<string>
    }
  ): Promise<Array<SynthesizedSpeech>> {
    const { segments, ...synthesisOptions } = input
    const nonEmptySegments = segments.map((text) => text.trim()).filter(Boolean)
    const results: Array<SynthesizedSpeech> = []

    for (const [index, text] of nonEmptySegments.entries()) {
      const previous = nonEmptySegments[index - 1]
      const next = nonEmptySegments[index + 1]
      const previousRequestId = results.at(-1)?.requestId

      results.push(
        await this.synthesize({
          ...synthesisOptions,
          text,
          previousText: previous,
          nextText: next,
          previousRequestIds: previousRequestId
            ? [previousRequestId]
            : undefined,
        })
      )
    }

    return results
  }

  async listVoices(options?: {
    pageSize?: number
    nextPageToken?: string
    search?: string
  }): Promise<{
    voices: Array<ElevenLabsVoice>
    hasMore: boolean
    nextPageToken: string | null
  }> {
    const url = new URL("/v2/voices", this.baseUrl)
    url.searchParams.set("page_size", String(options?.pageSize ?? 50))
    url.searchParams.set("include_total_count", "false")
    if (options?.nextPageToken) {
      url.searchParams.set("next_page_token", options.nextPageToken)
    }
    if (options?.search) url.searchParams.set("search", options.search)

    const response = await this.fetch(url, { headers: this.headers(false) })
    if (!response.ok) throw await toApiError(response)

    const body = (await response.json()) as VoiceListResponse
    return {
      voices: body.voices.map((voice) => ({
        voiceId: voice.voice_id,
        name: voice.name,
        category: voice.category,
        description: voice.description,
        previewUrl: voice.preview_url,
        labels: voice.labels,
      })),
      hasMore: body.has_more,
      nextPageToken: body.next_page_token,
    }
  }

  async listModels(): Promise<Array<ElevenLabsModel>> {
    const response = await this.fetch(new URL("/v1/models", this.baseUrl), {
      headers: this.headers(false),
    })
    if (!response.ok) throw await toApiError(response)

    const body = (await response.json()) as Array<ModelResponse>
    return body.map((model) => ({
      modelId: model.model_id,
      name: model.name,
      canDoTextToSpeech: model.can_do_text_to_speech,
      maximumTextLengthPerRequest: model.maximum_text_length_per_request,
      languages: model.languages.map((language) => ({
        languageId: language.language_id,
        name: language.name,
      })),
    }))
  }

  private headers(includeContentType = true): HeadersInit {
    return {
      "xi-api-key": this.apiKey,
      ...(includeContentType ? { "content-type": "application/json" } : {}),
    }
  }
}

function validateSynthesisInput(input: SynthesizeSpeechInput): void {
  if (!input.text.trim()) throw new Error("Text is required")
  if (!input.voiceId.trim()) throw new Error("Voice ID is required")
  if (input.previousRequestIds && input.previousRequestIds.length > 3) {
    throw new Error("ElevenLabs accepts at most 3 previous request IDs")
  }
  if (input.nextRequestIds && input.nextRequestIds.length > 3) {
    throw new Error("ElevenLabs accepts at most 3 next request IDs")
  }

  validateRange("seed", input.seed, 0, 4_294_967_295)
  validateRange("stability", input.voiceSettings?.stability, 0, 1)
  validateRange("similarityBoost", input.voiceSettings?.similarityBoost, 0, 1)
  validateRange("style", input.voiceSettings?.style, 0, 1)
  validateRange("speed", input.voiceSettings?.speed, 0.7, 1.2)
}

function validateRange(
  name: string,
  value: number | undefined,
  minimum: number,
  maximum: number
): void {
  if (value !== undefined && (value < minimum || value > maximum)) {
    throw new Error(`${name} must be between ${minimum} and ${maximum}`)
  }
}

function toApiVoiceSettings(settings: VoiceSettings): Record<string, unknown> {
  return {
    ...(settings.stability === undefined
      ? {}
      : { stability: settings.stability }),
    ...(settings.similarityBoost === undefined
      ? {}
      : { similarity_boost: settings.similarityBoost }),
    ...(settings.style === undefined ? {} : { style: settings.style }),
    ...(settings.useSpeakerBoost === undefined
      ? {}
      : { use_speaker_boost: settings.useSpeakerBoost }),
    ...(settings.speed === undefined ? {} : { speed: settings.speed }),
  }
}

async function toApiError(response: Response): Promise<ElevenLabsApiError> {
  let details: unknown
  try {
    details = await response.json()
  } catch {
    details = await response.text()
  }

  const message =
    extractErrorMessage(details) ??
    `ElevenLabs request failed (${response.status})`
  return new ElevenLabsApiError(response.status, message, details)
}

function extractErrorMessage(details: unknown): string | null {
  if (typeof details === "string" && details) return details
  if (!details || typeof details !== "object") return null

  const detail = "detail" in details ? details.detail : null
  if (typeof detail === "string") return detail
  if (detail && typeof detail === "object" && "message" in detail) {
    return typeof detail.message === "string" ? detail.message : null
  }
  return null
}

function contentType(format: AudioFormat): string {
  if (format.startsWith("mp3")) return "audio/mpeg"
  if (format.startsWith("pcm")) return "audio/pcm"
  return "audio/basic"
}

type VoiceListResponse = {
  voices: Array<{
    voice_id: string
    name: string
    category: string
    description: string | null
    preview_url: string | null
    labels: Record<string, string>
  }>
  has_more: boolean
  next_page_token: string | null
}

type ModelResponse = {
  model_id: string
  name: string
  can_do_text_to_speech: boolean
  maximum_text_length_per_request: number
  languages: Array<{ language_id: string; name: string }>
}
