import { Show, UserButton } from "@clerk/tanstack-react-start"
import { useRouterState } from "@tanstack/react-router"
import { useConvexAuth, useQuery } from "convex/react"
import { Coins } from "lucide-react"

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
  const usage = useQuery(
    api.tts.usage.getMyWeeklyUsage,
    isAuthenticated ? {} : "skip"
  )

  return (
    <UserButton>
      <UserButton.MenuItems>
        <UserButton.Action
          label={
            usage
              ? `${Math.round((usage.remaining / usage.limit) * 100)}% left`
              : "Loading tokens…"
          }
          labelIcon={<Coins className="size-4" />}
          onClick={() => {}}
        />
      </UserButton.MenuItems>
    </UserButton>
  )
}

export function AppNavbar() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

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
