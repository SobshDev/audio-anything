import { createFileRoute } from '@tanstack/react-router'
import { AuthShell } from '@/components/auth/auth-shell'
import { SignInForm } from '@/components/auth/sign-in-form'

export const Route = createFileRoute('/sign-in/$')({ component: Page })

function Page() {
  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Sign in to continue"
      description="Pick up where you left off and keep your daily picture complete."
    >
      <SignInForm />
    </AuthShell>
  )
}
