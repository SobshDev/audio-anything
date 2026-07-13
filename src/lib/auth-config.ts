/**
 * Shared routing constants for the Clerk custom auth flows.
 *
 * These mirror the `VITE_CLERK_*` environment values so the custom UI and the
 * Clerk redirect handling stay in sync.
 */
export const SIGN_IN_URL = "/sign-in"
export const SIGN_UP_URL = "/sign-up"

/** Where users land after a successful sign-in or sign-up. */
export const AFTER_AUTH_URL = "/"

/**
 * Intermediate route that runs `<AuthenticateWithRedirectCallback />` to finish
 * OAuth/SSO sign-in and sign-up. Both `redirectUrl` and `redirectCallbackUrl`
 * point here so every OAuth return path is finalized in one place.
 */
export const SSO_CALLBACK_URL = "/sso-callback"
