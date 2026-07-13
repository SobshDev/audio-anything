import type {
  ChatCompletion,
  ChatCompletionInput,
  JsonResponseFormat,
  LanguageModelProvider,
} from "./types"

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1"

type Fetch = typeof fetch

export type OpenRouterProviderOptions = {
  apiKey: string
  siteUrl?: string
  appTitle?: string
  baseUrl?: string
  fetch?: Fetch
}

export type OpenRouterModel = {
  id: string
  canonicalSlug: string
  name: string
  contextLength: number
  inputModalities: Array<string>
  outputModalities: Array<string>
  supportedParameters: Array<string>
  promptPrice: string
  completionPrice: string
}

export class OpenRouterApiError extends Error {
  readonly status: number
  readonly code: number | null
  readonly metadata: Record<string, unknown> | null
  readonly retryAfterSeconds: number | null

  constructor(options: {
    status: number
    code?: number
    message: string
    metadata?: Record<string, unknown>
    retryAfterSeconds?: number
  }) {
    super(options.message)
    this.name = "OpenRouterApiError"
    this.status = options.status
    this.code = options.code ?? null
    this.metadata = options.metadata ?? null
    this.retryAfterSeconds = options.retryAfterSeconds ?? null
  }
}

export class OpenRouterProvider implements LanguageModelProvider {
  private readonly apiKey: string
  private readonly siteUrl: string | undefined
  private readonly appTitle: string
  private readonly baseUrl: string
  private readonly fetch: Fetch

  constructor(options: OpenRouterProviderOptions) {
    if (!options.apiKey.trim())
      throw new Error("OpenRouter API key is required")

    this.apiKey = options.apiKey
    this.siteUrl = options.siteUrl
    this.appTitle = options.appTitle ?? "Audio Anything"
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "")
    this.fetch = options.fetch ?? globalThis.fetch
  }

  async complete(input: ChatCompletionInput): Promise<ChatCompletion> {
    validateCompletionInput(input)

    const response = await this.fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        model: input.model,
        messages: input.messages,
        stream: false,
        ...(input.maxCompletionTokens === undefined
          ? {}
          : { max_completion_tokens: input.maxCompletionTokens }),
        ...(input.temperature === undefined
          ? {}
          : { temperature: input.temperature }),
        ...(input.topP === undefined ? {} : { top_p: input.topP }),
        ...(input.seed === undefined ? {} : { seed: input.seed }),
        ...(input.stop === undefined ? {} : { stop: input.stop }),
        ...(input.responseFormat
          ? { response_format: toApiResponseFormat(input.responseFormat) }
          : {}),
      }),
    })

    const body = (await response.json()) as
      ChatCompletionResponse | ErrorResponse
    if (!response.ok || "error" in body) {
      throw toApiError(response, body)
    }

    const choice = body.choices.at(0)
    if (!choice)
      throw new OpenRouterApiError({
        status: 502,
        message: "OpenRouter returned no choices",
      })
    if (!body.usage) {
      throw new OpenRouterApiError({
        status: 502,
        message: "OpenRouter returned no token usage",
      })
    }

    return {
      id: body.id,
      model: body.model,
      content: choice.message.content ?? "",
      finishReason: choice.finish_reason,
      nativeFinishReason: choice.native_finish_reason ?? null,
      usage: {
        promptTokens: body.usage.prompt_tokens,
        completionTokens: body.usage.completion_tokens,
        totalTokens: body.usage.total_tokens,
        cost: body.usage.cost ?? null,
      },
    }
  }

  async listModels(): Promise<Array<OpenRouterModel>> {
    const response = await this.fetch(
      `${this.baseUrl}/models?output_modalities=text`,
      {
        headers: this.headers(false),
      }
    )
    const body = (await response.json()) as ModelsResponse | ErrorResponse
    if (!response.ok || "error" in body) throw toApiError(response, body)

    return body.data.map((model) => ({
      id: model.id,
      canonicalSlug: model.canonical_slug,
      name: model.name,
      contextLength: model.context_length,
      inputModalities: model.architecture.input_modalities,
      outputModalities: model.architecture.output_modalities,
      supportedParameters: model.supported_parameters,
      promptPrice: model.pricing.prompt,
      completionPrice: model.pricing.completion,
    }))
  }

  private headers(includeContentType = true): HeadersInit {
    return {
      authorization: `Bearer ${this.apiKey}`,
      ...(includeContentType ? { "content-type": "application/json" } : {}),
      ...(this.siteUrl ? { "http-referer": this.siteUrl } : {}),
      "x-openrouter-title": this.appTitle,
    }
  }
}

function validateCompletionInput(input: ChatCompletionInput): void {
  if (!input.model.trim()) throw new Error("OpenRouter model is required")
  if (input.messages.length === 0)
    throw new Error("At least one message is required")
  if (input.messages.some((message) => !message.content.trim())) {
    throw new Error("Messages cannot be empty")
  }
  validateRange("maxCompletionTokens", input.maxCompletionTokens, 1, 8_192)
  validateRange("temperature", input.temperature, 0, 2)
  validateRange("topP", input.topP, 0, 1, false)
}

function validateRange(
  name: string,
  value: number | undefined,
  minimum: number,
  maximum: number,
  includeMinimum = true
): void {
  if (
    value !== undefined &&
    (value > maximum || (includeMinimum ? value < minimum : value <= minimum))
  ) {
    throw new Error(`${name} must be between ${minimum} and ${maximum}`)
  }
}

function toApiResponseFormat(
  format: JsonResponseFormat
): Record<string, unknown> {
  if (format.type === "json_object") return format
  return {
    type: "json_schema",
    json_schema: format.jsonSchema,
  }
}

function toApiError(
  response: Response,
  body: ErrorResponse | unknown
): OpenRouterApiError {
  const error = isErrorResponse(body) ? body.error : undefined
  const retryAfter = Number(response.headers.get("retry-after"))
  return new OpenRouterApiError({
    status: response.status,
    code: error?.code,
    message: error?.message ?? `OpenRouter request failed (${response.status})`,
    metadata: error?.metadata,
    retryAfterSeconds:
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
  })
}

function isErrorResponse(body: unknown): body is ErrorResponse {
  if (!body || typeof body !== "object" || !("error" in body)) return false
  const error = body.error
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "number" &&
    "message" in error &&
    typeof error.message === "string"
  )
}

type ErrorResponse = {
  error: {
    code: number
    message: string
    metadata?: Record<string, unknown>
  }
}

type ChatCompletionResponse = {
  id: string
  model: string
  choices: Array<{
    message: { role: "assistant"; content: string | null }
    finish_reason: string | null
    native_finish_reason?: string | null
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
    cost?: number
  }
}

type ModelsResponse = {
  data: Array<{
    id: string
    canonical_slug: string
    name: string
    context_length: number
    architecture: {
      input_modalities: Array<string>
      output_modalities: Array<string>
    }
    supported_parameters: Array<string>
    pricing: { prompt: string; completion: string }
  }>
}
