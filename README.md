# audio-anything

TanStack Start application using Convex, Clerk, shadcn/ui, Tailwind CSS, and Bun.

## Configure services

Install dependencies and create your local environment file:

```bash
bun install
cp .env.example .env.local
```

Initialize or connect a Convex development deployment:

```bash
bunx convex dev
```

Add the generated `CONVEX_DEPLOYMENT` and `VITE_CONVEX_URL` values to
`.env.local`. In Clerk, create an application and add its publishable and secret
keys to the same file.

Create a Clerk JWT template named `convex`, then set
`CLERK_JWT_ISSUER_DOMAIN` in the Convex dashboard to your Clerk Frontend API
URL. The value is used by `convex/auth.config.ts` when Convex deploys.

## Develop

Run Convex and the web app together:

```bash
bun run dev
```

For debugging, they can still be started separately with `bun run dev:web`
and `bun run dev:convex`.

The app is available at <http://localhost:3000>.

## Useful commands

```bash
bun run build
bun run test
bunx shadcn@latest add card
```

Routes live in `src/routes`, Convex functions live in `convex`, and shadcn/ui
components live in `src/components/ui`.
