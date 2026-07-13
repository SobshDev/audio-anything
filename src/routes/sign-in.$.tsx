import { useEffect } from "react"
import { useAuth } from "@clerk/tanstack-react-start"
import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { AuthShell } from "@/components/auth/auth-shell"
import { SignInForm } from "@/components/auth/sign-in-form"
import { AFTER_AUTH_URL } from "@/lib/auth-config"

export const Route = createFileRoute("/sign-in/$")({
  component: Page,
})

function Page() {
  const { isSignedIn } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (isSignedIn) navigate({ to: AFTER_AUTH_URL })
  }, [isSignedIn, navigate])

  return (
    <AuthShell>
      <SignInForm />
    </AuthShell>
  )
}
