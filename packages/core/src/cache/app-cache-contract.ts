import { z } from "zod";

export const APP_CACHE_SECRET_HEADER = "x-zoonk-cache-secret";
const MAX_TAG_LENGTH = 256;
export const MAX_APP_CACHE_TAGS = 128;

/** The same tag policy applies to generated route tags, sender filtering and receiver parsing. */
export const appCacheTagSchema = z
  .string()
  .min(1)
  .max(MAX_TAG_LENGTH)
  .regex(/^[\p{L}\p{N}][\p{L}\p{N}\p{M}:._/-]*$/u);

/** Next.js tags are at most 256 characters; each hook request carries at most 128 tags. */
export const appCacheTagsSchema = z
  .object({ tags: z.array(appCacheTagSchema).min(1).max(MAX_APP_CACHE_TAGS) })
  .strict();
