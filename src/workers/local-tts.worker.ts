/// <reference lib="webworker" />

import { KokoroTTS } from "kokoro-js"
import { env as transformersEnv } from "@huggingface/transformers"

type GenerateMessage = {
  type: "generate"
  requestId: number
  turns: Array<{ text: string; voice: LocalVoice }>
}

type LocalVoice = "af_heart" | "am_michael" | "bf_emma"

const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX"
const HUGGING_FACE_MODEL_PREFIX =
  "https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/"
let modelPromise: Promise<KokoroTTS> | null = null
let activeRequestId = 0

transformersEnv.remoteHost = `${self.location.origin}/api/models/`
const nativeFetch = self.fetch.bind(self)
self.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url
  if (url.startsWith(HUGGING_FACE_MODEL_PREFIX)) {
    const proxied = `${self.location.origin}/api/models/${url.slice("https://huggingface.co/".length)}`
    return nativeFetch(proxied, init)
  }
  return nativeFetch(input, init)
}

self.onmessage = async (
  event: MessageEvent<GenerateMessage | { type: "stop" }>
) => {
  if (event.data.type === "stop") {
    activeRequestId += 1
    return
  }

  const { requestId, turns } = event.data
  activeRequestId = requestId
  try {
    self.postMessage({
      type: "status",
      requestId,
      status: "Loading local model…",
    })
    const tts = await getModel(requestId)
    if (activeRequestId !== requestId) return

    for (const [index, turn] of turns.entries()) {
      if (activeRequestId !== requestId) return
      self.postMessage({
        type: "status",
        requestId,
        status: `Generating passage ${index + 1} of ${turns.length}…`,
        progress: Math.round((index / turns.length) * 100),
      })
      const audio = await tts.generate(turn.text, {
        voice: turn.voice,
        speed: 1,
      })
      const wav = audio.toWav()
      self.postMessage(
        {
          type: "audio",
          requestId,
          buffer: wav,
          progress: Math.round(((index + 1) / turns.length) * 100),
        },
        [wav]
      )
    }
    self.postMessage({ type: "complete", requestId })
  } catch (error) {
    self.postMessage({
      type: "error",
      requestId,
      error:
        error instanceof Error
          ? error.message
          : "Local speech generation failed",
    })
  }
}

function getModel(requestId: number): Promise<KokoroTTS> {
  modelPromise ??= KokoroTTS.from_pretrained(MODEL_ID, {
    device: hasWebGpu() ? "webgpu" : "wasm",
    // Use the public 92 MB model_quantized.onnx artifact on both runtimes.
    // FP32 requests model.onnx (326 MB), which is unavailable from some Hub edges.
    dtype: "q8",
    progress_callback: (progress) => {
      if (activeRequestId !== requestId) return
      const value = "progress" in progress ? progress.progress : undefined
      self.postMessage({
        type: "model-progress",
        requestId,
        progress: typeof value === "number" ? Math.round(value) : undefined,
      })
    },
  }).catch((error: unknown) => {
    modelPromise = null
    throw error
  })
  return modelPromise
}

function hasWebGpu(): boolean {
  return "gpu" in navigator
}

export {}
