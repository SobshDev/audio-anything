import { Link } from "@tanstack/react-router"
import { useConvexAuth, useMutation, useQuery } from "convex/react"
import {
  EllipsisVerticalIcon,
  EyeIcon,
  FileTextIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import { api } from "../../../convex/_generated/api"
import type { Doc } from "../../../convex/_generated/dataModel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"

export function RecentDocuments() {
  const { isAuthenticated, isLoading } = useConvexAuth()
  const documents = useQuery(
    api.documents.listMine,
    isAuthenticated ? {} : "skip"
  )

  return (
    <section className="flex flex-col gap-3" aria-label="Recent documents">
      <div className="flex items-center justify-between px-1">
        <h2 className="font-heading text-base font-medium tracking-tight">
          Recent documents
        </h2>
      </div>

      {isLoading || (isAuthenticated && documents === undefined) ? (
        <Card size="sm">
          <div className="flex flex-col gap-3 px-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </Card>
      ) : documents?.length ? (
        <Card size="sm" className="divide-y py-2 [--card-spacing:--spacing(2)]">
          {documents.map((document) => (
            <DocumentRow key={document._id} document={document} />
          ))}
        </Card>
      ) : (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileTextIcon />
            </EmptyMedia>
            <EmptyTitle>No documents yet</EmptyTitle>
            <EmptyDescription>
              Upload a text-based PDF to create your first cleaned document.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </section>
  )
}

function DocumentRow({ document }: { document: Doc<"documents"> }) {
  const retry = useMutation(api.documents.retry)
  const remove = useMutation(api.documents.remove)
  const isProcessing =
    document.status === "queued" || document.status === "processing"

  async function retryDocument() {
    try {
      await retry({ documentId: document._id })
      toast.success("Processing restarted")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Retry failed")
    }
  }

  async function deleteDocument() {
    try {
      await remove({ documentId: document._id })
      toast.success("Document deleted")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed")
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <FileTextIcon className="size-4.5" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{document.filename}</p>
          <StatusBadge status={document.status} />
        </div>
        <p className="text-xs text-muted-foreground">
          PDF · {formatBytes(document.byteSize)} ·{" "}
          {formatDate(document._creationTime)}
        </p>
        {isProcessing ? (
          <Progress
            className="mt-2 h-1.5 max-w-xs"
            value={document.progress}
            aria-label={`${document.progress}% processed`}
          />
        ) : null}
        {document.status === "failed" && document.error ? (
          <p className="mt-1 truncate text-xs text-destructive">
            {document.error}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {document.status === "ready" ? (
          <Button variant="ghost" size="icon-sm" asChild>
            <Link
              to="/documents/$documentId"
              params={{ documentId: document._id }}
              aria-label={`Open ${document.filename}`}
            >
              <EyeIcon />
            </Link>
          </Button>
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`More options for ${document.filename}`}
            >
              <EllipsisVerticalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              {document.status === "ready" ? (
                <DropdownMenuItem asChild>
                  <Link
                    to="/documents/$documentId"
                    params={{ documentId: document._id }}
                  >
                    <EyeIcon />
                    View cleaned text
                  </Link>
                </DropdownMenuItem>
              ) : null}
              {document.status === "failed" ? (
                <DropdownMenuItem onSelect={() => void retryDocument()}>
                  <RefreshCwIcon />
                  Retry
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => void deleteDocument()}
              >
                <Trash2Icon />
                Delete
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: Doc<"documents">["status"] }) {
  if (status === "failed") return <Badge variant="destructive">Failed</Badge>
  if (status === "ready") return <Badge variant="secondary">Ready</Badge>
  return (
    <Badge variant="outline">
      {status === "queued" ? "Queued" : "Cleaning"}
    </Badge>
  )
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(timestamp)
}
