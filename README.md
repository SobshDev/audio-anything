# Kcal Count

TanStack Start app with Convex for the backend and Clerk for authentication.
The project uses Bun for dependency management and scripts.

## Setup

1. Install dependencies:

   ```bash
   bun install
   ```

2. Create a Convex project and development deployment:

   ```bash
   bunx convex dev
   ```

   Keep this process running. It writes `CONVEX_DEPLOYMENT` and
   `VITE_CONVEX_URL` to `.env.local`.

3. Create a Clerk application, then activate its Convex integration. Copy
   `.env.example` to `.env.local` and fill in the Clerk publishable key, secret
   key, and Frontend API URL.

4. In the Convex dashboard, add `CLERK_JWT_ISSUER_DOMAIN` with the same Clerk
   Frontend API URL. Restart `bunx convex dev` to sync `convex/auth.config.ts`.

5. Start the web app and Convex development sync together:

   ```bash
   bun run dev
   ```

Open <http://localhost:3000>.

## Commands

```bash
bun run dev          # TanStack Start and Convex development servers
bun run dev:web      # TanStack Start development server only
bun run dev:convex   # Convex development sync only
bun run build        # Production build
bun run lint         # ESLint
bun run test         # Vitest
```

## Documentation

- [TanStack Start](https://tanstack.com/start/latest/docs/framework/react/overview)
- [Convex with TanStack Start and Clerk](https://docs.convex.dev/client/tanstack/tanstack-start/clerk)
- [Clerk TanStack Start quickstart](https://clerk.com/docs/tanstack-react-start/getting-started/quickstart)
