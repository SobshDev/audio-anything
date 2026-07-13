import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/")({ component: App })

function App() {
  return <main className="min-h-[calc(100svh-5rem)]" />
}
