import { createFileRoute } from "@tanstack/react-router"

import { AddDocument } from "@/components/dashboard/add-document"
import { RecentDocuments } from "@/components/dashboard/recent-documents"

export const Route = createFileRoute("/")({ component: App })

function App() {
  return (
    <main className="min-h-[calc(100svh-5rem)] w-full px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <AddDocument />
        <RecentDocuments />
      </div>
    </main>
  )
}
