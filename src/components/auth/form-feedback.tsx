import { AlertCircle } from 'lucide-react'

export function FormFeedback({ message }: { message?: string }) {
  if (!message) return null
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-xl bg-destructive/10 px-3.5 py-3 text-sm leading-5 text-destructive"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  )
}

export function getErrorMessage(error: unknown) {
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string'
  )
    return error.message
  return 'Something went wrong. Please try again.'
}
