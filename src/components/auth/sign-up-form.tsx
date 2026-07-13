import { useState } from "react"
import { useSignUp } from "@clerk/tanstack-react-start"
import { Link } from "@tanstack/react-router"
import { ArrowLeftIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { ClerkErrorAlert } from "@/components/auth/clerk-error-alert"
import { OAuthButtons } from "@/components/auth/oauth-buttons"
import { OtpInput } from "@/components/auth/otp-input"
import { PasswordInput } from "@/components/auth/password-input"
import { AFTER_AUTH_URL } from "@/lib/auth-config"

type Screen = "start" | "verify"

export function SignUpForm() {
  const { signUp, errors, fetchStatus } = useSignUp()

  const [screen, setScreen] = useState<Screen>("start")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  const [manualError, setManualError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [redirecting, setRedirecting] = useState(false)

  const isBusy = busy || fetchStatus === "fetching"

  async function completeSignUp() {
    setRedirecting(true)
    await signUp.finalize({
      navigate: ({ decorateUrl }) => {
        window.location.href = decorateUrl(AFTER_AUTH_URL)
      },
    })
  }

  async function routeAfterCreate() {
    if (signUp.status === "complete") {
      await completeSignUp()
      return
    }
    // The account was created but the email still needs to be verified.
    if (signUp.unverifiedFields.includes("email_address")) {
      const { error } = await signUp.verifications.sendEmailCode()
      if (!error) {
        setCode("")
        setScreen("verify")
        toast.success(`We sent a verification code to ${email}.`)
      }
      return
    }
    // Any remaining missing fields surface through the reactive error object.
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setManualError(null)
    setBusy(true)
    const { error } = await signUp.password({
      emailAddress: email,
      password,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
    })
    if (error) {
      setBusy(false)
      return
    }
    await routeAfterCreate()
    setBusy(false)
  }

  async function handleVerify(value: string) {
    setManualError(null)
    setBusy(true)
    const { error } = await signUp.verifications.verifyEmailCode({
      code: value,
    })
    if (error) {
      setBusy(false)
      return
    }
    if (signUp.status === "complete") await completeSignUp()
    setBusy(false)
  }

  async function handleResend() {
    setManualError(null)
    const { error } = await signUp.verifications.sendEmailCode()
    if (!error) toast.success("We sent a new code.")
  }

  function backToStart() {
    setManualError(null)
    setCode("")
    setScreen("start")
    void signUp.reset()
  }

  if (redirecting) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <Spinner className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Setting up your account…
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        {screen === "start" ? (
          <>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Create your account</CardTitle>
              <CardDescription>
                Start turning audio into anything
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit}>
                <FieldGroup>
                  <ClerkErrorAlert
                    errors={errors.global}
                    message={manualError}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Field>
                      <FieldLabel htmlFor="first-name">First name</FieldLabel>
                      <Input
                        id="first-name"
                        autoComplete="given-name"
                        value={firstName}
                        onChange={(event) => setFirstName(event.target.value)}
                        aria-invalid={Boolean(errors.fields.firstName)}
                      />
                      <FieldError
                        errors={[errors.fields.firstName ?? undefined]}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="last-name">Last name</FieldLabel>
                      <Input
                        id="last-name"
                        autoComplete="family-name"
                        value={lastName}
                        onChange={(event) => setLastName(event.target.value)}
                        aria-invalid={Boolean(errors.fields.lastName)}
                      />
                      <FieldError
                        errors={[errors.fields.lastName ?? undefined]}
                      />
                    </Field>
                  </div>
                  <Field>
                    <FieldLabel htmlFor="email">Email</FieldLabel>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      aria-invalid={Boolean(errors.fields.emailAddress)}
                      required
                    />
                    <FieldError
                      errors={[errors.fields.emailAddress ?? undefined]}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="password">Password</FieldLabel>
                    <PasswordInput
                      id="password"
                      value={password}
                      onChange={setPassword}
                      autoComplete="new-password"
                      invalid={Boolean(errors.fields.password)}
                    />
                    <FieldError
                      errors={[errors.fields.password ?? undefined]}
                    />
                    <FieldDescription>
                      Use at least 8 characters.
                    </FieldDescription>
                  </Field>
                  <Field>
                    <Button type="submit" disabled={isBusy}>
                      {isBusy && <Spinner data-icon="inline-start" />}
                      Create account
                    </Button>
                  </Field>
                  <FieldSeparator>Or continue with</FieldSeparator>
                  <OAuthButtons
                    mode="sign-up"
                    disabled={isBusy}
                    onError={(message) => setManualError(message || null)}
                  />
                  {/* Clerk's bot-protection challenge renders here when enabled. */}
                  <div id="clerk-captcha" />
                </FieldGroup>
              </form>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Verify your email</CardTitle>
              <CardDescription>
                Enter the 6-digit code we sent to {email}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  handleVerify(code)
                }}
              >
                <FieldGroup>
                  <ClerkErrorAlert
                    errors={errors.global}
                    message={manualError}
                  />
                  <Field>
                    <OtpInput
                      value={code}
                      onChange={setCode}
                      onComplete={handleVerify}
                      disabled={isBusy}
                      invalid={Boolean(errors.fields.code)}
                      autoFocus
                    />
                    <FieldError
                      className="justify-center text-center"
                      errors={[errors.fields.code ?? undefined]}
                    />
                  </Field>
                  <Field>
                    <Button type="submit" disabled={isBusy || code.length < 6}>
                      {isBusy && <Spinner data-icon="inline-start" />}
                      Verify email
                    </Button>
                  </Field>
                  <FieldDescription className="text-center">
                    Didn&apos;t get a code?{" "}
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={isBusy}
                      className="underline underline-offset-4 disabled:opacity-50"
                    >
                      Resend
                    </button>
                  </FieldDescription>
                  <Button type="button" variant="ghost" onClick={backToStart}>
                    <ArrowLeftIcon data-icon="inline-start" />
                    Back
                  </Button>
                </FieldGroup>
              </form>
            </CardContent>
          </>
        )}
      </Card>

      {screen === "start" && (
        <FieldDescription className="px-6 text-center">
          Already have an account?{" "}
          <Link
            to="/sign-in/$"
            params={{ _splat: "" }}
            className="underline underline-offset-4"
          >
            Sign in
          </Link>
        </FieldDescription>
      )}
    </div>
  )
}
