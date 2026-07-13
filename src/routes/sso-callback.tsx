import { AuthenticateWithRedirectCallback } from "@clerk/tanstack-react-start"
import { createFileRoute } from "@tanstack/react-router"

import { Spinner } from "@/components/ui/spinner"
import { AFTER_AUTH_URL, SIGN_UP_URL } from "@/lib/auth-config"

export const Route = createFileRoute("/sso-callback")({
  component: Page,
})

/**
 * Finishes OAuth/SSO sign-in and sign-up. Clerk processes the provider
 * response here and then redirects onward (or continues an incomplete sign-up).
 */
function Page() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3">
      <Spinner className="size-6 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Completing sign-in…</p>
      <AuthenticateWithRedirectCallback
        signInFallbackRedirectUrl={AFTER_AUTH_URL}
        signUpFallbackRedirectUrl={AFTER_AUTH_URL}
        continueSignUpUrl={SIGN_UP_URL}
      />
    </div>
  )
}
