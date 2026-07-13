import { useState } from "react"
import { useSignIn, useSignUp } from "@clerk/tanstack-react-start"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { AFTER_AUTH_URL, SSO_CALLBACK_URL } from "@/lib/auth-config"

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1a11 11 0 0 0-9.82 6.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
        fill="#EA4335"
      />
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M17.05 12.54c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.09-2.01-3.76-2.04-1.6-.16-3.12.94-3.93.94-.81 0-2.06-.92-3.39-.9-1.74.03-3.35 1.01-4.25 2.57-1.81 3.15-.46 7.8 1.3 10.35.86 1.25 1.89 2.65 3.23 2.6 1.3-.05 1.79-.84 3.36-.84 1.57 0 2.01.84 3.39.81 1.4-.02 2.28-1.27 3.13-2.53.99-1.45 1.4-2.86 1.42-2.93-.03-.01-2.72-1.04-2.75-4.13ZM14.47 4.93c.71-.86 1.19-2.06 1.06-3.25-1.02.04-2.26.68-2.99 1.54-.66.76-1.23 1.98-1.08 3.15 1.14.09 2.3-.58 3.01-1.44Z"
        fill="currentColor"
      />
    </svg>
  )
}

const PROVIDERS = [
  { strategy: "oauth_google", label: "Google", Icon: GoogleIcon },
  { strategy: "oauth_apple", label: "Apple", Icon: AppleIcon },
] as const

type ProviderStrategy = (typeof PROVIDERS)[number]["strategy"]

/**
 * Social sign-in / sign-up buttons. On click they hand off to the OAuth
 * provider and return to {@link SSO_CALLBACK_URL} where the flow is finalized.
 */
export function OAuthButtons({
  mode,
  disabled,
  onError,
}: {
  mode: "sign-in" | "sign-up"
  disabled?: boolean
  onError: (message: string) => void
}) {
  const { signIn } = useSignIn()
  const { signUp } = useSignUp()
  const [pending, setPending] = useState<string | null>(null)

  async function authenticate(strategy: ProviderStrategy) {
    onError("")
    setPending(strategy)

    const resource = mode === "sign-in" ? signIn : signUp
    const { error } = await resource.sso({
      strategy,
      redirectUrl: AFTER_AUTH_URL,
      redirectCallbackUrl: SSO_CALLBACK_URL,
    })

    // On success the browser navigates to the provider, so we only reach this
    // point when the handoff itself failed.
    if (error) {
      setPending(null)
      onError(error.longMessage || error.message)
    }
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      {PROVIDERS.map(({ strategy, label, Icon }) => (
        <Button
          key={strategy}
          type="button"
          variant="outline"
          disabled={disabled || pending !== null}
          onClick={() => authenticate(strategy)}
        >
          {pending === strategy ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <span data-icon="inline-start" className="flex">
              <Icon />
            </span>
          )}
          {label}
        </Button>
      ))}
    </div>
  )
}
