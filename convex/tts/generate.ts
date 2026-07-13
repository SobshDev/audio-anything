import { v } from "convex/values"

import { internal } from "../_generated/api"
import { action, env } from "../_generated/server"
import type { Id } from "../_generated/dataModel"
import { ElevenLabsProvider } from "./elevenlabs"

type QuotaResult = {
  limit: number
  used: number
  remaining: number
  resetsAt: number
}

type GenerateSpeechResult = {
  storageId: Id<"_storage">
  contentType: string
  requestId: string | null
  quota: QuotaResult
}

const audioFormatValidator = v.union(
  v.literal("mp3_22050_32"),
  v.literal("mp3_44100_32"),
  v.literal("mp3_44100_64"),
  v.literal("mp3_44100_96"),
  v.literal("mp3_44100_128"),
  v.literal("mp3_44100_192"),
  v.literal("pcm_16000"),
  v.literal("pcm_22050"),
  v.literal("pcm_24000"),
  v.literal("pcm_44100"),
  v.literal("ulaw_8000")
)

export const generateSpeech = action({
  args: {
    text: v.string(),
    voiceId: v.string(),
    outputFormat: v.optional(audioFormatValidator),
    voiceSettings: v.optional(
      v.object({
        stability: v.optional(v.number()),
        similarityBoost: v.optional(v.number()),
        style: v.optional(v.number()),
        useSpeakerBoost: v.optional(v.boolean()),
        speed: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args): Promise<GenerateSpeechResult> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Authentication required")
    if (!args.text.trim()) throw new Error("Text is required")

    const apiKey = env.ELEVENLABS_API_KEY
    if (!apiKey) throw new Error("ElevenLabs is not configured")

    const accountId = identity.tokenIdentifier
    const characters = args.text.length
    const now = Date.now()
    const quota: QuotaResult = await ctx.runMutation(
      internal.tts.usage.reserveCharacters,
      {
        accountId,
        characters,
        now,
      }
    )

    try {
      const provider = new ElevenLabsProvider({ apiKey })
      const speech = await provider.synthesize({
        text: args.text,
        voiceId: args.voiceId,
        outputFormat: args.outputFormat,
        voiceSettings: args.voiceSettings,
      })
      const storageId: Id<"_storage"> = await ctx.storage.store(speech.audio)

      return {
        storageId,
        contentType: speech.contentType,
        requestId: speech.requestId,
        quota,
      }
    } catch (error) {
      await ctx.runMutation(internal.tts.usage.refundCharacters, {
        accountId,
        characters,
        now,
      })
      throw error
    }
  },
})
