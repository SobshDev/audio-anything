/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accounts from "../accounts.js";
import type * as llm_generate from "../llm/generate.js";
import type * as llm_openrouter from "../llm/openrouter.js";
import type * as llm_types from "../llm/types.js";
import type * as llm_usage from "../llm/usage.js";
import type * as plans from "../plans.js";
import type * as tts_elevenlabs from "../tts/elevenlabs.js";
import type * as tts_generate from "../tts/generate.js";
import type * as tts_types from "../tts/types.js";
import type * as tts_usage from "../tts/usage.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accounts: typeof accounts;
  "llm/generate": typeof llm_generate;
  "llm/openrouter": typeof llm_openrouter;
  "llm/types": typeof llm_types;
  "llm/usage": typeof llm_usage;
  plans: typeof plans;
  "tts/elevenlabs": typeof tts_elevenlabs;
  "tts/generate": typeof tts_generate;
  "tts/types": typeof tts_types;
  "tts/usage": typeof tts_usage;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
