import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useSignIn } from '@clerk/tanstack-react-start'
import { ArrowLeft } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormFeedback, getErrorMessage } from './form-feedback'
import { SubmitButton } from './submit-button'

type View = 'credentials' | 'reset-code' | 'new-password' | 'mfa'

export function SignInForm() {
  const { signIn, fetchStatus } = useSignIn()
  const [view, setView] = useState<View>('credentials')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string>()
  const loading = fetchStatus === 'fetching'

  const finish = async () => {
    const result = await signIn.finalize({
      navigate: ({ decorateUrl }) => {
        window.location.href = decorateUrl('/')
      },
    })
    if (result.error) setError(result.error.message)
  }

  const handleSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(undefined)
    try {
      const result = await signIn.password({ emailAddress: email, password })
      if (result.error) return setError(result.error.message)
      if (signIn.status === 'complete') return await finish()
      if (signIn.status === 'needs_second_factor') {
        if (
          !signIn.supportedSecondFactors.some(
            ({ strategy }) => strategy === 'email_code',
          )
        )
          return setError(
            'This account requires another authentication method.',
          )
        const mfaResult = await signIn.mfa.sendEmailCode()
        if (mfaResult.error) return setError(mfaResult.error.message)
        setView('mfa')
        return
      }
      setError('Additional verification is required to sign in.')
    } catch (caughtError) {
      setError(getErrorMessage(caughtError))
    }
  }

  const beginReset = async () => {
    if (!email) return setError('Enter your email address first.')
    setError(undefined)
    try {
      const createResult = await signIn.create({ identifier: email })
      if (createResult.error) return setError(createResult.error.message)
      const result = await signIn.resetPasswordEmailCode.sendCode()
      if (result.error) return setError(result.error.message)
      setView('reset-code')
    } catch (caughtError) {
      setError(getErrorMessage(caughtError))
    }
  }

  const verifyCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(undefined)
    const result =
      view === 'mfa'
        ? await signIn.mfa.verifyEmailCode({ code })
        : await signIn.resetPasswordEmailCode.verifyCode({ code })
    if (result.error) return setError(result.error.message)
    if (view === 'mfa' && signIn.status === 'complete') return await finish()
    setView('new-password')
  }

  const setNewPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(undefined)
    const result = await signIn.resetPasswordEmailCode.submitPassword({
      password,
    })
    if (result.error) return setError(result.error.message)
    if (signIn.status === 'complete') await finish()
  }

  if (view === 'reset-code' || view === 'mfa')
    return (
      <form className="space-y-5" onSubmit={verifyCode}>
        <BackButton
          onClick={() => {
            void signIn.reset()
            setView('credentials')
            setCode('')
            setError(undefined)
          }}
        />
        <Field label="Verification code" id="code">
          <Input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="Enter the 6-digit code"
            required
            autoFocus
          />
          <p className="text-xs leading-5 text-muted-foreground">
            We sent a code to {email}.
          </p>
        </Field>
        <FormFeedback message={error} />
        <SubmitButton loading={loading}>Verify code</SubmitButton>
      </form>
    )

  if (view === 'new-password')
    return (
      <form className="space-y-5" onSubmit={setNewPassword}>
        <Field label="New password" id="new-password">
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            required
            autoFocus
          />
        </Field>
        <FormFeedback message={error} />
        <SubmitButton loading={loading}>Update password</SubmitButton>
      </form>
    )

  return (
    <form className="space-y-5" onSubmit={handleSignIn}>
      <Field label="Email address" id="email">
        <Input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
          autoFocus
        />
      </Field>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="password">Password</Label>
          <button
            type="button"
            onClick={() => void beginReset()}
            className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Forgot password?
          </button>
        </div>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </div>
      <FormFeedback message={error} />
      <SubmitButton loading={loading}>Sign in</SubmitButton>
      <p className="text-center text-sm text-muted-foreground">
        New to Kcal Count?{' '}
        <Link
          to="/sign-up/$"
          params={{ _splat: '' }}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </form>
  )
}

function Field({
  label,
  id,
  children,
}: {
  label: string
  id: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}
function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      Back
    </button>
  )
}
