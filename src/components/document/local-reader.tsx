import { useEffect, useRef, useState } from "react"
import { PauseIcon, PlayIcon, SquareIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"

type ReaderStatus =
  "idle" | "loading-text" | "generating" | "playing" | "paused"
type Voice = "af_heart" | "am_michael" | "bf_emma"

const VOICES: Array<Voice> = ["af_heart", "am_michael", "bf_emma"]
const MAX_CHUNK_LENGTH = 420

export function LocalReader({
  texts,
  paginationStatus,
  loadMore,
}: {
  texts: Array<string>
  paginationStatus:
    "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted"
  loadMore: () => void
}) {
  const [status, setStatus] = useState<ReaderStatus>("idle")
  const [label, setLabel] = useState("Runs privately on this device")
  const [progress, setProgress] = useState(0)
  const workerRef = useRef<Worker | null>(null)
  const contextRef = useRef<AudioContext | null>(null)
  const nextStartRef = useRef(0)
  const requestIdRef = useRef(0)
  const pendingBuffersRef = useRef(0)
  const generationCompleteRef = useRef(false)

  useEffect(() => {
    if (status !== "loading-text") return
    if (paginationStatus === "CanLoadMore") loadMore()
    if (paginationStatus === "Exhausted") void beginGeneration()
  }, [paginationStatus, status])

  useEffect(
    () => () => {
      workerRef.current?.terminate()
      void contextRef.current?.close()
    },
    []
  )

  async function start() {
    const context = new AudioContext()
    await context.resume()
    contextRef.current = context
    nextStartRef.current = context.currentTime
    generationCompleteRef.current = false
    pendingBuffersRef.current = 0
    setProgress(0)
    if (paginationStatus === "Exhausted") await beginGeneration()
    else {
      setStatus("loading-text")
      setLabel("Loading the complete document…")
      if (paginationStatus === "CanLoadMore") loadMore()
    }
  }

  async function beginGeneration() {
    const turns = createLocalTurns(texts)
    if (!turns.length) {
      setStatus("idle")
      toast.error("This document has no text to read")
      return
    }
    const requestId = ++requestIdRef.current
    const worker =
      workerRef.current ??
      new Worker(
        new URL("../../workers/local-tts.worker.ts", import.meta.url),
        {
          type: "module",
        }
      )
    workerRef.current = worker
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      if (event.data.requestId !== requestIdRef.current) return
      if (event.data.type === "status") {
        setStatus("generating")
        setLabel(event.data.status)
        if (event.data.progress !== undefined) setProgress(event.data.progress)
      } else if (event.data.type === "model-progress") {
        setLabel(
          event.data.progress === undefined
            ? "Loading local model…"
            : `Loading local model… ${event.data.progress}%`
        )
      } else if (event.data.type === "audio") {
        setProgress(event.data.progress)
        void queueAudio(event.data.buffer)
      } else if (event.data.type === "complete") {
        generationCompleteRef.current = true
        finishWhenPlaybackEnds()
      } else {
        setStatus("idle")
        setLabel("Local generation failed")
        toast.error(event.data.error)
      }
    }
    setStatus("generating")
    worker.postMessage({ type: "generate", requestId, turns })
  }

  async function queueAudio(buffer: ArrayBuffer) {
    const context = contextRef.current
    if (!context) return
    const decoded = await context.decodeAudioData(buffer)
    const source = context.createBufferSource()
    source.buffer = decoded
    source.connect(context.destination)
    const startAt = Math.max(context.currentTime + 0.04, nextStartRef.current)
    nextStartRef.current = startAt + decoded.duration
    pendingBuffersRef.current += 1
    source.onended = () => {
      pendingBuffersRef.current -= 1
      finishWhenPlaybackEnds()
    }
    source.start(startAt)
    setStatus("playing")
    setLabel("Reading locally…")
  }

  function finishWhenPlaybackEnds() {
    if (!generationCompleteRef.current || pendingBuffersRef.current > 0) return
    setStatus("idle")
    setLabel("Finished · runs privately on this device")
  }

  async function togglePause() {
    const context = contextRef.current
    if (!context) return
    if (status === "paused") {
      await context.resume()
      setStatus("playing")
      setLabel("Reading locally…")
    } else {
      await context.suspend()
      setStatus("paused")
      setLabel("Paused")
    }
  }

  function stop() {
    requestIdRef.current += 1
    workerRef.current?.postMessage({ type: "stop" })
    void contextRef.current?.close()
    contextRef.current = null
    pendingBuffersRef.current = 0
    setStatus("idle")
    setProgress(0)
    setLabel("Stopped · runs privately on this device")
  }

  const active = status !== "idle"
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Local AI reader</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
        <div className="flex gap-2">
          {!active ? (
            <Button size="sm" onClick={() => void start()}>
              <PlayIcon data-icon="inline-start" />
              Read locally
            </Button>
          ) : (
            <>
              {(status === "playing" || status === "paused") && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void togglePause()}
                >
                  {status === "paused" ? <PlayIcon /> : <PauseIcon />}
                  {status === "paused" ? "Resume" : "Pause"}
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={stop}>
                <SquareIcon data-icon="inline-start" />
                Stop
              </Button>
            </>
          )}
        </div>
      </div>
      {active && <Progress value={progress} className="h-1.5" />}
      <p className="text-xs text-muted-foreground">
        First use downloads the 92 MB quantized Kokoro model. WebGPU is used
        when available, with a CPU fallback.
      </p>
    </div>
  )
}

type WorkerResponse =
  | { type: "status"; requestId: number; status: string; progress?: number }
  | { type: "model-progress"; requestId: number; progress?: number }
  | { type: "audio"; requestId: number; buffer: ArrayBuffer; progress: number }
  | { type: "complete"; requestId: number }
  | { type: "error"; requestId: number; error: string }

export function createLocalTurns(
  texts: Array<string>
): Array<{ text: string; voice: Voice }> {
  const speakerVoices = new Map<string, Voice>([["Narrator", VOICES[0]]])
  const turns: Array<{ text: string; voice: Voice }> = []
  for (const block of texts) {
    for (const line of block
      .split(/\n+/)
      .map((value) => value.trim())
      .filter(Boolean)) {
      const match = line.match(/^([\p{L}][\p{L}\p{M} .'-]{0,48}):\s+(.+)$/u)
      const speaker = match?.[1].trim() ?? "Narrator"
      const text = match?.[2] ?? line
      if (!speakerVoices.has(speaker)) {
        speakerVoices.set(speaker, VOICES[speakerVoices.size % VOICES.length])
      }
      for (const chunk of splitText(text)) {
        turns.push({ text: chunk, voice: speakerVoices.get(speaker)! })
      }
    }
  }
  return turns
}

function splitText(text: string): Array<string> {
  const chunks: Array<string> = []
  let remaining = text.trim()
  while (remaining.length > MAX_CHUNK_LENGTH) {
    const window = remaining.slice(0, MAX_CHUNK_LENGTH)
    const boundary = Math.max(window.lastIndexOf(". "), window.lastIndexOf(" "))
    const end =
      boundary > MAX_CHUNK_LENGTH / 2 ? boundary + 1 : MAX_CHUNK_LENGTH
    chunks.push(remaining.slice(0, end).trim())
    remaining = remaining.slice(end).trim()
  }
  if (remaining) chunks.push(remaining)
  return chunks
}
