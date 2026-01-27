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
import type * as edgarParser_edgarDailyIndexForms from "../edgarParser/edgarDailyIndexForms.js";
import type * as edgarParser_edgarFetchClient from "../edgarParser/edgarFetchClient.js";
import type * as edgarParser_form4_form4Normalizers from "../edgarParser/form4/form4Normalizers.js";
import type * as edgarParser_form4_form4Types from "../edgarParser/form4/form4Types.js";
import type * as edgarParser_form4_form4Urls from "../edgarParser/form4/form4Urls.js";
import type * as edgarParser_form4_form4XmlConfig from "../edgarParser/form4/form4XmlConfig.js";
import type * as edgarParser_form4_index from "../edgarParser/form4/index.js";
import type * as secFilings from "../secFilings.js";
import type * as utils from "../utils.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  crons: typeof crons;
  "edgarParser/edgarDailyIndexForms": typeof edgarParser_edgarDailyIndexForms;
  "edgarParser/edgarFetchClient": typeof edgarParser_edgarFetchClient;
  "edgarParser/form4/form4Normalizers": typeof edgarParser_form4_form4Normalizers;
  "edgarParser/form4/form4Types": typeof edgarParser_form4_form4Types;
  "edgarParser/form4/form4Urls": typeof edgarParser_form4_form4Urls;
  "edgarParser/form4/form4XmlConfig": typeof edgarParser_form4_form4XmlConfig;
  "edgarParser/form4/index": typeof edgarParser_form4_index;
  secFilings: typeof secFilings;
  utils: typeof utils;
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
