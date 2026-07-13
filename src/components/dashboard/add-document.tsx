import { FileAudioIcon, PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

/**
 * Dashed drop-zone style block inviting the user to add a document.
 * UI only for now — the button and drop target carry no logic yet.
 */
export function AddDocument() {
  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileAudioIcon />
        </EmptyMedia>
        <EmptyTitle>Add a document</EmptyTitle>
        <EmptyDescription>
          Drop a file here or browse your device. We&apos;ll turn it into audio
          you can listen to anywhere.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button>
          <PlusIcon data-icon="inline-start" />
          Add document
        </Button>
        <p className="text-xs text-muted-foreground">
          PDF, DOCX, EPUB or TXT — up to 25 MB
        </p>
      </EmptyContent>
    </Empty>
  )
}
