import {
  CopyIcon,
  DownloadIcon,
  EllipsisVerticalIcon,
  FileTextIcon,
  PenLineIcon,
  PlayIcon,
  Trash2Icon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// Placeholder data until documents are wired to the backend.
const documents = [
  {
    id: "doc-1",
    name: "Q3 Marketing Report",
    type: "PDF",
    duration: "12 min",
    addedAt: "2 days ago",
  },
  {
    id: "doc-2",
    name: "Meeting Notes — Product Sync",
    type: "DOCX",
    duration: "4 min",
    addedAt: "3 days ago",
  },
  {
    id: "doc-3",
    name: "The Art of Sound Design",
    type: "EPUB",
    duration: "1 h 08 min",
    addedAt: "Last week",
  },
  {
    id: "doc-4",
    name: "Research Paper — Speech Synthesis",
    type: "PDF",
    duration: "26 min",
    addedAt: "Last week",
  },
  {
    id: "doc-5",
    name: "Onboarding Guide",
    type: "TXT",
    duration: "7 min",
    addedAt: "2 weeks ago",
  },
] as const

export function RecentDocuments() {
  return (
    <section className="flex flex-col gap-3" aria-label="Recent documents">
      <div className="flex items-center justify-between px-1">
        <h2 className="font-heading text-base font-medium tracking-tight">
          Recent documents
        </h2>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          View all
        </Button>
      </div>

      <Card size="sm" className="divide-y py-2 [--card-spacing:--spacing(2)]">
        {documents.map((doc) => (
          <DocumentRow key={doc.id} doc={doc} />
        ))}
      </Card>
    </section>
  )
}

function DocumentRow({ doc }: { doc: (typeof documents)[number] }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <FileTextIcon className="size-4.5" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{doc.name}</p>
        <p className="text-xs text-muted-foreground">
          {doc.type} · {doc.duration} · {doc.addedAt}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button variant="ghost" size="icon-sm" aria-label={`Play ${doc.name}`}>
          <PlayIcon />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`More options for ${doc.name}`}
            >
              <EllipsisVerticalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>
              <PenLineIcon />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem>
              <DownloadIcon />
              Download audio
            </DropdownMenuItem>
            <DropdownMenuItem>
              <CopyIcon />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive">
              <Trash2Icon />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
