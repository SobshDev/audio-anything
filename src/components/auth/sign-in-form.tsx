import { useState } from "react"
import { useSignIn } from "@clerk/tanstack-react-start"
import { Link } from "@tanstack/react-router"
import { ArrowLeftIcon, MailIcon } from "lucide-react"
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

type Screen = "start" | "email-code" | "mfa" | "reset-code" | "reset-password"
type SecondFactor = "totp" | "phone_code" | "email_code" | "backup_code"

export function SignInForm() {
  const { signIn, errors, fetchStatus } = useSignIn()

  const [screen, setScreen] = useState<Screen>("start")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [secondFactor, setSecondFactor] = useState<SecondFactor>("totp")
  const [backupAvailable, setBackupAvailable] = useState(false)
  const [useBackupCode, setUseBackupCode] = useState(false)
  const [manualError, setManualError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [redirecting, setRedirecting] = useState(false)

  const isBusy = busy || fetchStatus === "fetching"

  async function completeSignIn() {
    setRedirecting(true)
    await signIn.finalize({
      navigate: ({ decorateUrl }) => {
        // decorateUrl may return an absolute URL (Safari ITP); a hard redirect
        // re-initializes the Clerk + Convex providers with the new session.
        window.location.href = decorateUrl(AFTER_AUTH_URL)
      },
    })
  }

  async function routeAfterFirstFactor() {
    if (signIn.status === "complete") {
      await completeSignIn()
      return
    }
    if (
      signIn.status === "needs_second_factor" ||
      signIn.status === "needs_client_trust"
    ) {
      await enterSecondFactor()
    }
  }

  async function enterSecondFactor() {
    const factors = signIn.supportedSecondFactors
    const has = (strategy: string) =>
      factors.some((factor) => factor.strategy === strategy)

    setBackupAvailable(has("backup_code"))
    setUseBackupCode(false)
    setCode("")

    let strategy: SecondFactor = "totp"
    if (has("totp")) strategy = "totp"
    else if (has("phone_code")) strategy = "phone_code"
    else if (has("email_code")) strategy = "email_code"
    else if (has("backup_code")) {
      strategy = "backup_code"
      setUseBackupCode(true)
    }
    setSecondFactor(strategy)

    if (strategy === "phone_code") await signIn.mfa.sendPhoneCode()
    else if (strategy === "email_code") await signIn.mfa.sendEmailCode()

    setScreen("mfa")
  }

  async function handlePasswordSubmit(event: React.FormEvent) {
    event.preventDefault()
    setManualError(null)
    setBusy(true)
    const { error } = await signIn.password({ identifier: email, password })
    if (error) {
      setBusy(false)
      return
    }
    await routeAfterFirstFactor()
    setBusy(false)
  }

  async function handleEmailCodeRequest() {
    setManualError(null)
    if (!email) {
      setManualError("Enter your email address first.")
      return
    }
    setBusy(true)
    const { error } = await signIn.emailCode.sendCode({ emailAddress: email })
    setBusy(false)
    if (error) return
    setCode("")
    setScreen("email-code")
    toast.success(`We sent a sign-in code to ${email}.`)
  }

  async function handleEmailCodeVerify(value: string) {
    setManualError(null)
    setBusy(true)
    const { error } = await signIn.emailCode.verifyCode({ code: value })
    if (error) {
      setBusy(false)
      return
    }
    if (signIn.status === "complete") await completeSignIn()
    setBusy(false)
  }

  async function handleForgotPassword() {
    setManualError(null)
    if (!email) {
      setManualError("Enter your email address so we can send a reset code.")
      return
    }
    setBusy(true)
    const created = await signIn.create({ identifier: email })
    if (created.error) {
      setBusy(false)
      return
    }
    const { error } = await signIn.resetPasswordEmailCode.sendCode()
    setBusy(false)
    if (error) return
    setCode("")
    setScreen("reset-code")
    toast.success(`We sent a password reset code to ${email}.`)
  }

  async function handleResetCodeVerify(value: string) {
    setManualError(null)
    setBusy(true)
    const { error } = await signIn.resetPasswordEmailCode.verifyCode({
      code: value,
    })
    setBusy(false)
    if (error) return
    if (signIn.status === "needs_new_password") {
      setNewPassword("")
      setScreen("reset-password")
    }
  }

  async function handleResetPasswordSubmit(event: React.FormEvent) {
    event.preventDefault()
    setManualError(null)
    setBusy(true)
    const { error } = await signIn.resetPasswordEmailCode.submitPassword({
      password: newPassword,
    })
    if (error) {
      setBusy(false)
      return
    }
    if (signIn.status === "complete") await completeSignIn()
    setBusy(false)
  }

  async function handleMfaVerify(value: string) {
    setManualError(null)
    setBusy(true)
    const request = useBackupCode
      ? signIn.mfa.verifyBackupCode({ code: value })
      : secondFactor === "totp"
        ? signIn.mfa.verifyTOTP({ code: value })
        : secondFactor === "phone_code"
          ? signIn.mfa.verifyPhoneCode({ code: value })
          : signIn.mfa.verifyEmailCode({ code: value })
    const { error } = await request
    if (error) {
      setBusy(false)
      return
    }
    if (signIn.status === "complete") await completeSignIn()
    setBusy(false)
  }

  async function handleResendSecondFactor() {
    if (secondFactor === "phone_code") {
      await signIn.mfa.sendPhoneCode()
      toast.success("We sent a new code.")
    } else if (secondFactor === "email_code") {
      await signIn.mfa.sendEmailCode()
      toast.success("We sent a new code.")
    }
  }

  function backToStart() {
    setManualError(null)
    setCode("")
    setPassword("")
    setScreen("start")
    void signIn.reset()
  }

  if (redirecting) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <Spinner className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Signing you in…</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        {screen === "start" && (
          <>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Welcome back</CardTitle>
              <CardDescription>
                Sign in to your Audio Anything account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordSubmit}>
                <FieldGroup>
                  <ClerkErrorAlert
                    errors={errors.global}
                    message={manualError}
                  />
                  <Field>
                    <FieldLabel htmlFor="email">Email</FieldLabel>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      aria-invalid={Boolean(errors.fields.identifier)}
                      required
                    />
                    <FieldError
                      errors={[errors.fields.identifier ?? undefined]}
                    />
                  </Field>
                  <Field>
                    <div className="flex items-center">
                      <FieldLabel htmlFor="password">Password</FieldLabel>
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        disabled={isBusy}
                        className="ml-auto text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-50"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <PasswordInput
                      id="password"
                      value={password}
                      onChange={setPassword}
                      autoComplete="current-password"
                      invalid={Boolean(errors.fields.password)}
                    />
                    <FieldError
                      errors={[errors.fields.password ?? undefined]}
                    />
                  </Field>
                  <Field>
                    <Button type="submit" disabled={isBusy}>
                      {isBusy && <Spinner data-icon="inline-start" />}
                      Sign in
                    </Button>
                  </Field>
                  <Field>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleEmailCodeRequest}
                      disabled={isBusy}
                    >
                      <MailIcon data-icon="inline-start" />
                      Email me a sign-in code
                    </Button>
                  </Field>
                  <FieldSeparator>Or continue with</FieldSeparator>
                  <OAuthButtons
                    mode="sign-in"
                    disabled={isBusy}
                    onError={(message) => setManualError(message || null)}
                  />
                </FieldGroup>
              </form>
            </CardContent>
          </>
        )}

        {screen === "email-code" && (
          <CodeStep
            title="Check your email"
            description={`Enter the 6-digit code we sent to ${email}.`}
            code={code}
            onCodeChange={setCode}
            onComplete={handleEmailCodeVerify}
            onSubmit={() => handleEmailCodeVerify(code)}
            onResend={handleEmailCodeRequest}
            onBack={backToStart}
            error={errors.fields.code}
            globalErrors={errors.global}
            manualError={manualError}
            isBusy={isBusy}
          />
        )}

        {screen === "mfa" && (
          <CodeStep
            title="Two-step verification"
            description={
              useBackupCode
                ? "Enter one of your backup codes."
                : secondFactor === "totp"
                  ? "Enter the code from your authenticator app."
                  : "Enter the verification code we sent you."
            }
            code={code}
            onCodeChange={setCode}
            onComplete={useBackupCode ? undefined : handleMfaVerify}
            onSubmit={() => handleMfaVerify(code)}
            onResend={
              !useBackupCode &&
              (secondFactor === "phone_code" || secondFactor === "email_code")
                ? handleResendSecondFactor
                : undefined
            }
            onBack={backToStart}
            error={errors.fields.code}
            globalErrors={errors.global}
            manualError={manualError}
            isBusy={isBusy}
            freeform={useBackupCode}
            footer={
              backupAvailable ? (
                <button
                  type="button"
                  onClick={() => {
                    setUseBackupCode((previous) => !previous)
                    setCode("")
                    setManualError(null)
                  }}
                  className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  {useBackupCode
                    ? "Use your authenticator or verification code instead"
                    : "Use a backup code instead"}
                </button>
              ) : undefined
            }
          />
        )}

        {screen === "reset-code" && (
          <CodeStep
            title="Reset your password"
            description={`Enter the 6-digit code we sent to ${email}.`}
            code={code}
            onCodeChange={setCode}
            onComplete={handleResetCodeVerify}
            onSubmit={() => handleResetCodeVerify(code)}
            onResend={handleForgotPassword}
            onBack={backToStart}
            error={errors.fields.code}
            globalErrors={errors.global}
            manualError={manualError}
            isBusy={isBusy}
          />
        )}

        {screen === "reset-password" && (
          <>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Choose a new password</CardTitle>
              <CardDescription>
                Enter a new password for {email}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleResetPasswordSubmit}>
                <FieldGroup>
                  <ClerkErrorAlert
                    errors={errors.global}
                    message={manualError}
                  />
                  <Field>
                    <FieldLabel htmlFor="new-password">New password</FieldLabel>
                    <PasswordInput
                      id="new-password"
                      value={newPassword}
                      onChange={setNewPassword}
                      autoComplete="new-password"
                      invalid={Boolean(errors.fields.password)}
                      autoFocus
                    />
                    <FieldError
                      errors={[errors.fields.password ?? undefined]}
                    />
                  </Field>
                  <Field>
                    <Button type="submit" disabled={isBusy}>
                      {isBusy && <Spinner data-icon="inline-start" />}
                      Reset password
                    </Button>
                  </Field>
                  <BackButton onClick={backToStart} />
                </FieldGroup>
              </form>
            </CardContent>
          </>
        )}
      </Card>

      {screen === "start" && (
        <FieldDescription className="px-6 text-center">
          Don&apos;t have an account?{" "}
          <Link
            to="/sign-up/$"
            params={{ _splat: "" }}
            className="underline underline-offset-4"
          >
            Sign up
          </Link>
        </FieldDescription>
      )}
    </div>
  )
}

/** Shared verification-code screen used by every code-based sign-in step. */
function CodeStep({
  title,
  description,
  code,
  onCodeChange,
  onComplete,
  onSubmit,
  onResend,
  onBack,
  error,
  globalErrors,
  manualError,
  isBusy,
  freeform,
  footer,
}: {
  title: string
  description: string
  code: string
  onCodeChange: (value: string) => void
  onComplete?: (value: string) => void
  onSubmit: () => void
  onResend?: () => void
  onBack: () => void
  error?: { message?: string } | null
  globalErrors?: ReadonlyArray<{
    message?: string
    longMessage?: string
  }> | null
  manualError?: string | null
  isBusy: boolean
  freeform?: boolean
  footer?: React.ReactNode
}) {
  return (
    <>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit()
          }}
        >
          <FieldGroup>
            <ClerkErrorAlert errors={globalErrors} message={manualError} />
            <Field>
              {freeform ? (
                <Input
                  aria-label="Backup code"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(event) => onCodeChange(event.target.value)}
                  aria-invalid={Boolean(error)}
                  autoFocus
                />
              ) : (
                <OtpInput
                  value={code}
                  onChange={onCodeChange}
                  onComplete={onComplete}
                  disabled={isBusy}
                  invalid={Boolean(error)}
                  autoFocus
                />
              )}
              <FieldError
                className="justify-center text-center"
                errors={[error ?? undefined]}
              />
            </Field>
            <Field>
              <Button
                type="submit"
                disabled={isBusy || (!freeform && code.length < 6)}
              >
                {isBusy && <Spinner data-icon="inline-start" />}
                Verify
              </Button>
            </Field>
            {onResend && (
              <FieldDescription className="text-center">
                Didn&apos;t get a code?{" "}
                <button
                  type="button"
                  onClick={onResend}
                  disabled={isBusy}
                  className="underline underline-offset-4 disabled:opacity-50"
                >
                  Resend
                </button>
              </FieldDescription>
            )}
            {footer && <div className="flex justify-center">{footer}</div>}
            <BackButton onClick={onBack} />
          </FieldGroup>
        </form>
      </CardContent>
    </>
  )
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" onClick={onClick}>
      <ArrowLeftIcon data-icon="inline-start" />
      Back to sign in
    </Button>
  )
}
