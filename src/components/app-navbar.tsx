import { Show, UserButton, useAuth } from "@clerk/tanstack-react-start"
import { useRouterState } from "@tanstack/react-router"
import { useConvexAuth, useQuery } from "convex/react"
import { Gauge, ShieldIcon } from "lucide-react"

import { api } from "../../convex/_generated/api"
import { Button } from "@/components/ui/button"
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu"
import { SIGN_IN_URL } from "@/lib/auth-config"

const navigationItems = [
  { label: "Dashboard", to: "/" },
  { label: "Audios", to: "/audios" },
  { label: "Settings", to: "/settings" },
] as const

function UserButtonWithTokens() {
  // Convex auth can lag slightly behind Clerk's signed-in state, so skip the
  // query until the Convex client is authenticated.
  const { isAuthenticated } = useConvexAuth()
  const llmUsage = useQuery(
    api.llm.usage.getMyWeeklyUsage,
    isAuthenticated ? {} : "skip"
  )
  const ttsUsage = useQuery(
    api.tts.usage.getMyWeeklyUsage,
    isAuthenticated ? {} : "skip"
  )

  const quotas = llmUsage && ttsUsage ? [llmUsage, ttsUsage] : null
  const lowestQuota = quotas?.reduce((lowest, quota) =>
    quota.remaining / quota.limit < lowest.remaining / lowest.limit
      ? quota
      : lowest
  )

  const label = lowestQuota
    ? `${Math.round((lowestQuota.remaining / lowestQuota.limit) * 100)}% left · resets ${new Date(
        lowestQuota.resetsAt
      ).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
    : "Loading tokens…"

  return (
    <UserButton>
      <UserButton.MenuItems>
        <UserButton.Action
          label={label}
          labelIcon={<Gauge className="size-4" />}
          onClick={() => {}}
        />
      </UserButton.MenuItems>
    </UserButton>
  )
}

export function AppNavbar() {
  const { sessionClaims } = useAuth()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const isAdmin = sessionClaims?.metadata?.role === "admin"

  if (pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up")) {
    return null
  }

  return (
    <header className="w-full px-4 pt-4 sm:px-6 lg:px-8">
      <div className="mx-auto grid h-16 w-full max-w-screen-2xl grid-cols-[1fr_auto_1fr] items-center rounded-full border bg-background/90 px-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/75 sm:px-6 lg:px-8">
        <div aria-hidden="true" />

        <NavigationMenu viewport={false} aria-label="Primary navigation">
          <NavigationMenuList className="gap-1">
            {navigationItems.map((item) => (
              <NavigationMenuItem key={item.to}>
                <NavigationMenuLink
                  asChild
                  active={pathname === item.to}
                  className={navigationMenuTriggerStyle()}
                >
                  <a href={item.to}>{item.label}</a>
                </NavigationMenuLink>
              </NavigationMenuItem>
            ))}
            {isAdmin && (
              <NavigationMenuItem>
                <NavigationMenuLink
                  asChild
                  active={pathname === "/admin"}
                  className={navigationMenuTriggerStyle()}
                >
                  <a href="/admin">
                    <ShieldIcon />
                    Admin
                  </a>
                </NavigationMenuLink>
              </NavigationMenuItem>
            )}
          </NavigationMenuList>
        </NavigationMenu>

        <div className="justify-self-end">
          <Show when="signed-out">
            <Button asChild variant="ghost">
              <a href={SIGN_IN_URL}>Sign In</a>
            </Button>
          </Show>

          <Show when="signed-in">
            <UserButtonWithTokens />
          </Show>
        </div>
      </div>
    </header>
  )
}
