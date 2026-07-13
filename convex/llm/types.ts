export type ChatRole = "system" | "user" | "assistant"

export type ChatMessage = {
  role: ChatRole
  content: string
  name?: string
}

export type JsonResponseFormat =
  | { type: "json_object" }
  | {
      type: "json_schema"
      jsonSchema: {
        name: string
        strict?: boolean
        schema: Record<string, unknown>
      }
    }

export type ChatCompletionInput = {
  model: string
  messages: Array<ChatMessage>
  maxCompletionTokens?: number
  temperature?: number
  topP?: number
  seed?: number
  stop?: string | Array<string>
  reasoningEffort?: "minimal" | "low" | "medium" | "high"
  responseFormat?: JsonResponseFormat
}

export type TokenUsage = {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  cost: number | null
}

export type ChatCompletion = {
  id: string
  model: string
  content: string
  finishReason: string | null
  nativeFinishReason: string | null
  usage: TokenUsage
}

export interface LanguageModelProvider {
  complete: (input: ChatCompletionInput) => Promise<ChatCompletion>
}
