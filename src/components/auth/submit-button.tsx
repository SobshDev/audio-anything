import { LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function SubmitButton({
  children,
  loading,
}: {
  children: React.ReactNode
  loading: boolean
}) {
  return (
    <Button className="h-10 w-full" type="submit" disabled={loading}>
      {loading && (
        <LoaderCircle
          className="size-4 animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
      )}
      {children}
    </Button>
  )
}
