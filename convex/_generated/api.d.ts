/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as crons from "../crons.js";
import type * as helpers_edgarDailyIndexForms from "../helpers/edgarDailyIndexForms.js";
import type * as helpers_edgarFetchClient from "../helpers/edgarFetchClient.js";
import type * as helpers_utils from "../helpers/utils.js";
import type * as secFilings from "../secFilings.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  crons: typeof crons;
  "helpers/edgarDailyIndexForms": typeof helpers_edgarDailyIndexForms;
  "helpers/edgarFetchClient": typeof helpers_edgarFetchClient;
  "helpers/utils": typeof helpers_utils;
  secFilings: typeof secFilings;
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
