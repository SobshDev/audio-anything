import { useRef, useState } from "react"
import { useConvexAuth, useMutation } from "convex/react"
import { FileAudioIcon, PlusIcon, UploadIcon } from "lucide-react"
import { toast } from "sonner"

import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Progress } from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

const MAX_FILE_SIZE = 25 * 1024 * 1024

export function AddDocument() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const { isAuthenticated } = useConvexAuth()
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl)
  const startIngestion = useMutation(api.documents.startIngestion)

  async function upload(file: File) {
    const validationError = validatePdf(file)
    if (validationError) {
      toast.error(validationError)
      return
    }
    if (!isAuthenticated) {
      toast.error("Sign in to upload a document")
      return
    }

    setUploadProgress(15)
    try {
      const uploadUrl = await generateUploadUrl()
      setUploadProgress(40)
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "application/pdf" },
        body: file,
      })
      if (!response.ok) throw new Error("Upload failed")
      const result = (await response.json()) as { storageId?: string }
      if (!result.storageId) throw new Error("Upload failed")
      setUploadProgress(80)
      await startIngestion({
        storageId: result.storageId as Id<"_storage">,
        filename: file.name,
      })
      setUploadProgress(100)
      toast.success("PDF uploaded. Cleaning has started.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed")
    } finally {
      setUploadProgress(null)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <Empty
      className={cn(
        "border border-dashed transition-colors",
        isDragging && "border-primary bg-muted/40"
      )}
      onDragEnter={(event) => {
        event.preventDefault()
        setIsDragging(true)
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          setIsDragging(false)
        }
      }}
      onDrop={(event) => {
        event.preventDefault()
        setIsDragging(false)
        const file = event.dataTransfer.files.item(0)
        if (file) void upload(file)
      }}
    >
      <EmptyHeader>
        <EmptyMedia variant="icon">
          {uploadProgress === null ? <FileAudioIcon /> : <UploadIcon />}
        </EmptyMedia>
        <EmptyTitle>
          {uploadProgress === null ? "Add a document" : "Uploading PDF"}
        </EmptyTitle>
        <EmptyDescription>
          {uploadProgress === null
            ? "Drop a PDF here or browse your device. We'll clean it and prepare it for audio."
            : "Your document will continue processing after the upload completes."}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        {uploadProgress === null ? (
          <Button
            disabled={!isAuthenticated}
            onClick={() => inputRef.current?.click()}
          >
            <PlusIcon data-icon="inline-start" />
            Add PDF
          </Button>
        ) : (
          <div className="flex w-full max-w-xs flex-col gap-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Spinner />
              Uploading…
            </div>
            <Progress value={uploadProgress} aria-label="Upload progress" />
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          PDF with selectable text · up to 25 MB
        </p>
        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept="application/pdf,.pdf"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void upload(file)
          }}
        />
      </EmptyContent>
    </Empty>
  )
}

export function validatePdf(file: Pick<File, "name" | "size" | "type">) {
  if (
    file.type !== "application/pdf" &&
    !file.name.toLowerCase().endsWith(".pdf")
  ) {
    return "Only PDF files are supported"
  }
  if (file.size > MAX_FILE_SIZE) return "PDF files must be 25 MB or smaller"
  if (file.size === 0) return "The selected PDF is empty"
  return null
}
