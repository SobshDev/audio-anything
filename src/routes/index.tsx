import { Show, SignInButton, SignUpButton } from "@clerk/tanstack-react-start"
import { createFileRoute } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"

export const Route = createFileRoute("/")({ component: App })

function App() {
  return (
    <main className="flex min-h-[calc(100svh-5rem)] items-center justify-center p-6">
      <div className="flex max-w-xl flex-col items-start gap-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            TanStack Start · shadcn/ui · Clerk · Convex
          </p>
          <h1 className="text-4xl font-semibold tracking-tight">
            Audio Anything is ready.
          </h1>
          <p className="text-muted-foreground">
            Add your Clerk and Convex environment values to connect the local
            scaffold to your cloud projects.
          </p>
        </div>

        <Show when="signed-out">
          <div className="flex gap-3">
            <SignInButton mode="modal">
              <Button>Sign in</Button>
            </SignInButton>
            <SignUpButton mode="modal">
              <Button variant="outline">Create account</Button>
            </SignUpButton>
          </div>
        </Show>

        <Show when="signed-in">
          <p className="text-sm text-muted-foreground">
            Clerk and Convex providers are connected.
          </p>
        </Show>
      </div>
    </main>
  )
}
