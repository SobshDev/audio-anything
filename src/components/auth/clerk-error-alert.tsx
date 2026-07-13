import { TriangleAlertIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

type GlobalError = { message?: string; longMessage?: string } | undefined

/**
 * Renders a destructive alert for form-level (non field-specific) errors.
 *
 * Accepts Clerk's reactive `errors.global` array plus an optional client-side
 * validation message, so both surface in the same place.
 */
export function ClerkErrorAlert({
  errors,
  message,
}: {
  errors?: ReadonlyArray<GlobalError> | null
  message?: string | null
}) {
  const parts: Array<string> = []
  if (message) parts.push(message)
  for (const error of errors ?? []) {
    const text = error?.longMessage || error?.message
    if (text) parts.push(text)
  }

  if (parts.length === 0) return null

  return (
    <Alert variant="destructive">
      <TriangleAlertIcon />
      <AlertTitle>We couldn&apos;t continue</AlertTitle>
      <AlertDescription>{parts.join(" ")}</AlertDescription>
    </Alert>
  )
}
