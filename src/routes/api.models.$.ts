import { createFileRoute } from "@tanstack/react-router"

const MODEL_PREFIX = "onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/"
const ALLOWED_FILES = new Set([
  "config.json",
  "tokenizer.json",
  "tokenizer_config.json",
  "onnx/model_quantized.onnx",
  "voices/af_heart.bin",
  "voices/am_michael.bin",
  "voices/bf_emma.bin",
])

export const Route = createFileRoute("/api/models/$")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const pathname = new URL(request.url).pathname
        const requestedPath = decodeURIComponent(
          pathname.slice("/api/models/".length)
        )
        if (!requestedPath.startsWith(MODEL_PREFIX)) {
          return new Response("Model not allowed", { status: 403 })
        }
        const filename = requestedPath.slice(MODEL_PREFIX.length)
        if (!ALLOWED_FILES.has(filename)) {
          return new Response("Model file not allowed", { status: 403 })
        }

        const upstreamUrl = new URL(`https://huggingface.co/${requestedPath}`)
        upstreamUrl.searchParams.set("download", "true")
        const upstream = await fetch(upstreamUrl, {
          headers: {
            accept: "application/octet-stream,*/*",
            "user-agent": "Audio-Anything local model loader",
            ...(request.headers.get("range")
              ? { range: request.headers.get("range")! }
              : {}),
          },
          redirect: "follow",
        })
        if (!upstream.ok && upstream.status !== 206) {
          return new Response(
            `Hugging Face model download failed (${upstream.status})`,
            {
              status: 502,
              headers: {
                "cache-control": "no-store",
                "x-model-upstream-status": String(upstream.status),
              },
            }
          )
        }

        const headers = new Headers({
          "cache-control": "public, max-age=31536000, immutable",
          "content-type":
            upstream.headers.get("content-type") ?? "application/octet-stream",
        })
        for (const name of [
          "content-length",
          "content-range",
          "accept-ranges",
        ]) {
          const value = upstream.headers.get(name)
          if (value) headers.set(name, value)
        }
        return new Response(upstream.body, {
          status: upstream.status,
          headers,
        })
      },
    },
  },
})
