import { mutation, query } from "./_generated/server"
import { getAccountPlan, isAppAdmin, PLAN_LIMITS, planValidator } from "./plans"
import { startOfUtcWeek } from "./tts/usage"

export const getMyPlan = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Authentication required")

    const plan = await getAccountPlan(ctx, identity.tokenIdentifier)
    return { plan, limits: PLAN_LIMITS[plan] }
  },
})

export const setMyPlan = mutation({
  args: { plan: planValidator },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Authentication required")
    if (!isAppAdmin(identity.metadata)) {
      throw new Error("Administrator access required")
    }

    const account = await ctx.db
      .query("accounts")
      .withIndex("by_accountId", (q) =>
        q.eq("accountId", identity.tokenIdentifier)
      )
      .unique()

    if (account) {
      await ctx.db.patch("accounts", account._id, { plan: args.plan })
    } else {
      await ctx.db.insert("accounts", {
        accountId: identity.tokenIdentifier,
        plan: args.plan,
      })
    }

    return { plan: args.plan, limits: PLAN_LIMITS[args.plan] }
  },
})

export const resetMyWeeklyUsage = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Authentication required")
    if (!isAppAdmin(identity.metadata)) {
      throw new Error("Administrator access required")
    }

    const weekStart = startOfUtcWeek(Date.now())
    const [llmUsage, ttsUsage] = await Promise.all([
      ctx.db
        .query("weeklyLlmUsage")
        .withIndex("by_accountId_and_weekStart", (q) =>
          q.eq("accountId", identity.tokenIdentifier).eq("weekStart", weekStart)
        )
        .unique(),
      ctx.db
        .query("weeklyTtsUsage")
        .withIndex("by_accountId_and_weekStart", (q) =>
          q.eq("accountId", identity.tokenIdentifier).eq("weekStart", weekStart)
        )
        .unique(),
    ])

    if (llmUsage) await ctx.db.delete("weeklyLlmUsage", llmUsage._id)
    if (ttsUsage) await ctx.db.delete("weeklyTtsUsage", ttsUsage._id)

    return null
  },
})
