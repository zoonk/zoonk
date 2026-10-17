import { toSlug } from "@zoonk/utils/string";

const MAX_KEY_LENGTH = 40;

/**
 * The stored key of a field or tool version: a slug, so "Google Sheets", "google sheets" and
 * "Google-Sheets" are one version.
 */
export function toVariantKey(value: string): string {
  return toSlug(value).slice(0, MAX_KEY_LENGTH);
}
