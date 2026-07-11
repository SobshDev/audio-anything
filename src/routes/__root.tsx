import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouteContext,
  useRouterState,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import type { QueryClient } from '@tanstack/react-query'
import { createServerFn } from '@tanstack/react-start'
import {
  ClerkProvider,
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
  useAuth,
} from '@clerk/tanstack-react-start'
import { auth } from '@clerk/tanstack-react-start/server'
import { shadcn } from '@clerk/ui/themes'
import type { ConvexQueryClient } from '@convex-dev/react-query'
import type { ConvexReactClient } from 'convex/react'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import { Button } from '@/components/ui/button'

import appCss from '../styles.css?url'

const fetchClerkAuth = createServerFn({ method: 'GET' }).handler(async () => {
  const { userId, getToken } = await auth()
  return { userId, token: await getToken() }
})

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
  convexClient: ConvexReactClient
  convexQueryClient: ConvexQueryClient
}>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Kcal Count',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  beforeLoad: async ({ context }) => {
    const clerkAuth = await fetchClerkAuth()
    if (clerkAuth.token) {
      context.convexQueryClient.serverHttpClient?.setAuth(clerkAuth.token)
    }
    return clerkAuth
  },
  component: RootComponent,
})

function RootComponent() {
  const { convexClient } = useRouteContext({ from: Route.id })

  return (
    <ClerkProvider appearance={{ theme: shadcn }}>
      <ConvexProviderWithClerk client={convexClient} useAuth={useAuth}>
        <RootDocument>
          <Outlet />
        </RootDocument>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  const isAuthRoute = useRouterState({
    select: ({ location }) =>
      location.pathname.startsWith('/sign-in') ||
      location.pathname.startsWith('/sign-up'),
  })

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {!isAuthRoute && (
          <header className="flex items-center justify-between border-b border-border px-8 py-4">
            <span className="font-semibold">Kcal Count</span>
            <Show when="signed-out">
              <div className="flex items-center gap-2">
                <SignInButton mode="redirect">
                  <Button variant="ghost">Sign in</Button>
                </SignInButton>
                <SignUpButton mode="redirect">
                  <Button>Sign up</Button>
                </SignUpButton>
              </div>
            </Show>
            <Show when="signed-in">
              <UserButton />
            </Show>
          </header>
        )}
        {children}
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
