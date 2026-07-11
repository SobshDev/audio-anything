import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useSignUp } from '@clerk/tanstack-react-start'
import { ArrowLeft } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormFeedback, getErrorMessage } from './form-feedback'
import { SubmitButton } from './submit-button'

export function SignUpForm() {
  const { signUp, fetchStatus } = useSignUp()
  const [verifying, setVerifying] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string>()
  const loading = fetchStatus === 'fetching'

  const finish = async () => {
    const result = await signUp.finalize({
      navigate: ({ decorateUrl }) => {
        window.location.href = decorateUrl('/')
      },
    })
    if (result.error) setError(result.error.message)
  }

  const handleSignUp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(undefined)
    try {
      const result = await signUp.password({ emailAddress: email, password })
      if (result.error) return setError(result.error.message)
      if (signUp.status === 'complete') return await finish()
      const codeResult = await signUp.verifications.sendEmailCode()
      if (codeResult.error) return setError(codeResult.error.message)
      setVerifying(true)
    } catch (caughtError) {
      setError(getErrorMessage(caughtError))
    }
  }

  const handleVerify = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(undefined)
    try {
      const result = await signUp.verifications.verifyEmailCode({ code })
      if (result.error) return setError(result.error.message)
      if (signUp.status === 'complete') return await finish()
      setError('Your account needs additional information before it is ready.')
    } catch (caughtError) {
      setError(getErrorMessage(caughtError))
    }
  }

  if (verifying)
    return (
      <form className="space-y-5" onSubmit={handleVerify}>
        <button
          type="button"
          onClick={() => {
            void signUp.reset()
            setVerifying(false)
            setCode('')
            setError(undefined)
          }}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Change email
        </button>
        <div className="space-y-2">
          <Label htmlFor="sign-up-code">Verification code</Label>
          <Input
            id="sign-up-code"
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
        </div>
        <FormFeedback message={error} />
        <SubmitButton loading={loading}>Verify email</SubmitButton>
      </form>
    )

  return (
    <form className="space-y-5" onSubmit={handleSignUp}>
      <div className="space-y-2">
        <Label htmlFor="sign-up-email">Email address</Label>
        <Input
          id="sign-up-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
          autoFocus
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="sign-up-password">Password</Label>
        <Input
          id="sign-up-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={8}
          required
        />
        <p className="text-xs leading-5 text-muted-foreground">
          Use at least 8 characters.
        </p>
      </div>
      <FormFeedback message={error} />
      <SubmitButton loading={loading}>Create account</SubmitButton>
      <div id="clerk-captcha" />
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link
          to="/sign-in/$"
          params={{ _splat: '' }}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  )
}
