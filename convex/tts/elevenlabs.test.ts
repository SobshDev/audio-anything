import { describe, expect, it, vi } from "vitest"

import type { ElevenLabsApiError } from "./elevenlabs"
import { ElevenLabsProvider } from "./elevenlabs"

describe("ElevenLabsProvider", () => {
  it("maps synthesis options to the official API", async () => {
    const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = []
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        requests.push({ input, init })
        return new Response(new Uint8Array([1, 2, 3]), {
          headers: {
            "content-type": "audio/mpeg",
            "request-id": "request-1",
          },
        })
      }
    )
    const provider = new ElevenLabsProvider({
      apiKey: "secret",
      fetch: fetchMock,
    })

    const result = await provider.synthesize({
      text: "Hello world",
      voiceId: "voice/a",
      seed: 42,
      voiceSettings: { stability: 0.6, similarityBoost: 0.8, speed: 0.95 },
    })

    expect(result.requestId).toBe("request-1")
    expect(result.audio.size).toBe(3)
    const request = requests[0]
    expect(String(request.input)).toBe(
      "https://api.elevenlabs.io/v1/text-to-speech/voice%2Fa?output_format=mp3_44100_128"
    )
    expect(request.init?.headers).toMatchObject({ "xi-api-key": "secret" })
    expect(JSON.parse(String(request.init?.body))).toEqual({
      text: "Hello world",
      model_id: "eleven_multilingual_v2",
      seed: 42,
      voice_settings: {
        stability: 0.6,
        similarity_boost: 0.8,
        speed: 0.95,
      },
    })
  })

  it("links long-form segments with text and request context", async () => {
    let requestNumber = 0
    const bodies: Array<unknown> = []
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body)))
        requestNumber += 1
        return new Response(new Uint8Array([requestNumber]), {
          headers: { "request-id": `request-${requestNumber}` },
        })
      }
    )
    const provider = new ElevenLabsProvider({
      apiKey: "secret",
      fetch: fetchMock,
    })

    await provider.synthesizeSegments({
      voiceId: "voice-id",
      segments: ["First.", "Second.", "Third."],
    })

    expect(bodies[1]).toMatchObject({
      text: "Second.",
      previous_text: "First.",
      next_text: "Third.",
      previous_request_ids: ["request-1"],
    })
  })

  it("preserves API error details", async () => {
    const provider = new ElevenLabsProvider({
      apiKey: "secret",
      fetch: vi.fn(async () =>
        Response.json(
          { detail: { message: "Invalid voice ID", status: "invalid_voice" } },
          { status: 422 }
        )
      ),
    })

    await expect(
      provider.synthesize({ text: "Hello", voiceId: "missing" })
    ).rejects.toMatchObject({
      status: 422,
      message: "Invalid voice ID",
    } satisfies Partial<ElevenLabsApiError>)
  })
})
