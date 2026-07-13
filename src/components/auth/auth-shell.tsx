import { AudioLinesIcon } from "lucide-react"
import { Link } from "@tanstack/react-router"

/**
 * Two-column authentication layout: an editorial brand panel on the left
 * (desktop only) and the auth card centered on the right.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex">
        {/* Ambient decoration */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.07]">
          <div className="absolute -top-24 -left-24 size-96 rounded-full bg-primary-foreground blur-3xl" />
          <div className="absolute -right-16 -bottom-32 size-96 rounded-full bg-primary-foreground blur-3xl" />
        </div>

        <Link
          to="/"
          className="relative z-10 flex items-center gap-2.5 text-lg font-semibold tracking-tight"
        >
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary-foreground/10 ring-1 ring-primary-foreground/20 ring-inset">
            <AudioLinesIcon className="size-5" />
          </span>
          Audio Anything
        </Link>

        <div className="relative z-10 flex flex-col gap-6">
          <Waveform />
          <blockquote className="max-w-md space-y-3">
            <p className="text-2xl leading-snug font-medium text-balance">
              Turn any sound into something extraordinary.
            </p>
            <footer className="text-sm text-primary-foreground/70">
              Transcribe, transform, and understand audio — all in one place.
            </footer>
          </blockquote>
        </div>
      </aside>

      <main className="flex flex-col items-center justify-center p-6 md:p-10">
        <div className="flex w-full max-w-sm flex-col gap-6">
          <Link
            to="/"
            className="flex items-center gap-2 self-center text-base font-semibold tracking-tight lg:hidden"
          >
            <AudioLinesIcon className="size-5" />
            Audio Anything
          </Link>
          {children}
        </div>
      </main>
    </div>
  )
}

/** Purely decorative equalizer bars for the brand panel. */
function Waveform() {
  const heights = [28, 52, 40, 72, 48, 88, 60, 96, 56, 76, 44, 64, 36, 24]
  return (
    <div
      className="flex h-24 items-end gap-1.5"
      aria-hidden="true"
      role="presentation"
    >
      {heights.map((height, index) => (
        <div
          key={index}
          className="w-2 rounded-full bg-primary-foreground/50"
          style={{ height: `${height}%` }}
        />
      ))}
    </div>
  )
}
