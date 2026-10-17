import { createHash } from "node:crypto";

/** UUID version 8 marks ids built from custom data instead of time or randomness. */
const UUID_VERSION = "8";

/** RFC 9562 variant bits (10xx), so the id passes every UUID check. */
const UUID_VARIANT = "8";

/**
 * A stable UUID for a seed key such as `lesson:physics:electron:pt`. Running the seed again
 * produces the same ids, so every row is an upsert and nothing is duplicated.
 */
export function seedId(key: string): string {
  const hex = createHash("sha256").update(`zoonk-seed-v2:${key}`).digest("hex");

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `${UUID_VERSION}${hex.slice(13, 16)}`,
    `${UUID_VARIANT}${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}
