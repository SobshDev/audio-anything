import { defineApp } from "convex/server"
import { v } from "convex/values"

export default defineApp({
  env: {
    CLERK_JWT_ISSUER_DOMAIN: v.string(),
    ELEVENLABS_API_KEY: v.optional(v.string()),
    OPENROUTER_API_KEY: v.optional(v.string()),
    OPENROUTER_SITE_URL: v.optional(v.string()),
  },
})
