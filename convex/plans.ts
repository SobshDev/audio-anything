import type { Infer } from "convex/values"
import { v } from "convex/values"

import type { MutationCtx, QueryCtx } from "./_generated/server"

export const planValidator = v.union(
  v.literal("free"),
  v.literal("premium"),
  v.literal("max")
)

export type Plan = Infer<typeof planValidator>

export const PLAN_LIMITS: Record<
  Plan,
  { llmTokens: number; ttsCharacters: number }
> = {
  free: { llmTokens: 50_000, ttsCharacters: 2_500 },
  premium: { llmTokens: 250_000, ttsCharacters: 25_000 },
  max: { llmTokens: 1_000_000, ttsCharacters: 125_000 },
}

export async function getAccountPlan(
  ctx: QueryCtx | MutationCtx,
  accountId: string
): Promise<Plan> {
  const account = await ctx.db
    .query("accounts")
    .withIndex("by_accountId", (q) => q.eq("accountId", accountId))
    .unique()
  return account?.plan ?? "free"
}

export async function getPlanLimits(
  ctx: QueryCtx | MutationCtx,
  accountId: string
) {
  const plan = await getAccountPlan(ctx, accountId)
  return { plan, ...PLAN_LIMITS[plan] }
}

export function isAppAdmin(metadata: unknown): boolean {
  return (
    typeof metadata === "object" &&
    metadata !== null &&
    !Array.isArray(metadata) &&
    "role" in metadata &&
    metadata.role === "admin"
  )
}
