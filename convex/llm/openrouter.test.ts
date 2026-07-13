import { describe, expect, it, vi } from "vitest"

import type { OpenRouterApiError } from "./openrouter"
import { OpenRouterProvider } from "./openrouter"

describe("OpenRouterProvider", () => {
  it("uses a dynamically selected model and maps native usage", async () => {
    const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = []
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        requests.push({ input, init })
        return Response.json({
          id: "gen-1",
          model: "anthropic/claude-sonnet-4",
          choices: [
            {
              message: { role: "assistant", content: "A concise summary." },
              finish_reason: "stop",
            },
          ],
          usage: {
            prompt_tokens: 120,
            completion_tokens: 30,
            total_tokens: 150,
            cost: 0.001,
          },
        })
      }
    )
    const provider = new OpenRouterProvider({
      apiKey: "secret",
      siteUrl: "https://example.com",
      fetch: fetchMock,
    })

    const result = await provider.complete({
      model: "anthropic/claude-sonnet-4",
      messages: [{ role: "user", content: "Summarize this." }],
      maxCompletionTokens: 500,
    })

    expect(result.usage.totalTokens).toBe(150)
    const request = requests[0]
    expect(String(request.input)).toBe(
      "https://openrouter.ai/api/v1/chat/completions"
    )
    expect(request.init?.headers).toMatchObject({
      authorization: "Bearer secret",
      "http-referer": "https://example.com",
    })
    expect(JSON.parse(String(request.init?.body))).toMatchObject({
      model: "anthropic/claude-sonnet-4",
      stream: false,
      max_completion_tokens: 500,
    })
  })

  it("surfaces API errors and retry timing", async () => {
    const provider = new OpenRouterProvider({
      apiKey: "secret",
      fetch: vi.fn(async () =>
        Response.json(
          { error: { code: 429, message: "Rate limited" } },
          { status: 429, headers: { "retry-after": "30" } }
        )
      ),
    })

    await expect(
      provider.complete({
        model: "openai/gpt-4.1-mini",
        messages: [{ role: "user", content: "Hello" }],
      })
    ).rejects.toMatchObject({
      status: 429,
      retryAfterSeconds: 30,
    } satisfies Partial<OpenRouterApiError>)
  })
})
