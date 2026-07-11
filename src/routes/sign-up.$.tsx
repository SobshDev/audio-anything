import { createFileRoute } from '@tanstack/react-router'
import { AuthShell } from '@/components/auth/auth-shell'
import { SignUpForm } from '@/components/auth/sign-up-form'

export const Route = createFileRoute('/sign-up/$')({ component: Page })

function Page() {
  return (
    <AuthShell
      eyebrow="Start fresh"
      title="Create your account"
      description="A focused place for your nutrition, built around clarity rather than pressure."
    >
      <SignUpForm />
    </AuthShell>
  )
}
