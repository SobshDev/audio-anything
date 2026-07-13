import { Link, createFileRoute } from "@tanstack/react-router"
import {
  useConvexAuth,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "convex/react"
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  FileTextIcon,
  RefreshCwIcon,
} from "lucide-react"
import { toast } from "sonner"

import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export const Route = createFileRoute("/documents/$documentId")({
  component: DocumentPage,
})

function DocumentPage() {
  const { documentId } = Route.useParams()
  const id = documentId as Id<"documents">
  const { isAuthenticated } = useConvexAuth()
  const document = useQuery(
    api.documents.getMine,
    isAuthenticated ? { documentId: id } : "skip"
  )
  const retry = useMutation(api.documents.retry)
  const kept = usePaginatedQuery(
    api.documents.listBlocks,
    isAuthenticated ? { documentId: id, action: "kept" } : "skip",
    { initialNumItems: 100 }
  )
  const removed = usePaginatedQuery(
    api.documents.listBlocks,
    isAuthenticated ? { documentId: id, action: "removed" } : "skip",
    { initialNumItems: 100 }
  )

  if (document === undefined) return <DocumentSkeleton />
  if (document === null) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileTextIcon />
            </EmptyMedia>
            <EmptyTitle>Document not found</EmptyTitle>
            <EmptyDescription>
              This document does not exist or is not available to your account.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </main>
    )
  }

  const processing =
    document.status === "queued" || document.status === "processing"

  return (
    <main className="min-h-[calc(100svh-5rem)] w-full px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <Button variant="ghost" size="sm" className="self-start" asChild>
          <Link to="/">
            <ArrowLeftIcon data-icon="inline-start" />
            Documents
          </Link>
        </Button>

        <div className="flex flex-col gap-2 px-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-medium tracking-tight">
              {document.filename}
            </h1>
            <Badge
              variant={
                document.status === "failed" ? "destructive" : "secondary"
              }
            >
              {document.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {document.pageCount ?? "—"} pages · {document.keptBlockCount ?? 0}{" "}
            kept · {document.removedBlockCount ?? 0} removed
          </p>
        </div>

        {processing ? (
          <Card>
            <CardHeader>
              <CardTitle>Cleaning your PDF</CardTitle>
              <CardDescription>
                Extracting readable content and removing repeated page
                furniture.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Progress value={document.progress} />
              <p className="text-xs text-muted-foreground">
                {document.progress}% complete
              </p>
            </CardContent>
          </Card>
        ) : null}

        {document.status === "failed" ? (
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>Processing failed</AlertTitle>
            <AlertDescription>
              {document.error ?? "Please try this PDF again."}
            </AlertDescription>
            <Button
              className="mt-3"
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await retry({ documentId: id })
                  toast.success("Processing restarted")
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : "Retry failed"
                  )
                }
              }}
            >
              <RefreshCwIcon data-icon="inline-start" />
              Retry
            </Button>
          </Alert>
        ) : null}

        {document.status === "ready" ? (
          <Tabs defaultValue="cleaned">
            <TabsList>
              <TabsTrigger value="cleaned">Cleaned text</TabsTrigger>
              <TabsTrigger value="removed">
                Removed ({document.removedBlockCount ?? 0})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="cleaned">
              <Card>
                <CardHeader>
                  <CardTitle>Cleaned document</CardTitle>
                  <CardDescription>
                    Content ready for the audio pipeline.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 leading-7">
                  {kept.results.map((block) => (
                    <p key={block._id}>{block.text}</p>
                  ))}
                  <LoadMore result={kept} />
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="removed">
              <div className="flex flex-col gap-3">
                {removed.results.length ? (
                  removed.results.map((block) => (
                    <Card key={block._id} size="sm">
                      <CardHeader>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">
                            Page {block.pageStart}
                          </Badge>
                          <Badge variant="secondary">
                            {formatReason(block.reason)}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="text-sm leading-6 text-muted-foreground">
                        {block.text}
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <Empty className="border">
                    <EmptyHeader>
                      <EmptyTitle>Nothing was removed</EmptyTitle>
                      <EmptyDescription>
                        The original content was preserved.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )}
                <LoadMore result={removed} />
              </div>
            </TabsContent>
          </Tabs>
        ) : null}
      </div>
    </main>
  )
}

function LoadMore({
  result,
}: {
  result: ReturnType<typeof usePaginatedQuery<typeof api.documents.listBlocks>>
}) {
  if (result.status === "Exhausted") return null
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={result.status === "LoadingMore"}
      onClick={() => result.loadMore(100)}
    >
      {result.status === "LoadingMore" ? "Loading…" : "Load more"}
    </Button>
  )
}

function DocumentSkeleton() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-8 sm:px-6">
      <Skeleton className="h-9 w-28" />
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-80 w-full" />
    </main>
  )
}

function formatReason(reason?: string) {
  return (reason ?? "removed").replaceAll("_", " ")
}
