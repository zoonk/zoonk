import { isJsonObject } from "@zoonk/utils/json";

const malformedJsonBackslashEscape = "\u00005c";
const postgresUnsupportedNullCharacter = "\u0000";

/**
 * Repairs malformed JSON escapes that models sometimes emit when they meant a
 * literal backslash for LaTeX, then removes any remaining NULs because
 * PostgreSQL JSONB cannot store U+0000 inside text values.
 */
function normalizeStepContentString(value: string): string {
  return value
    .replaceAll(malformedJsonBackslashEscape, "\\")
    .replaceAll(postgresUnsupportedNullCharacter, "");
}

/**
 * Normalizes one object entry while keeping object keys untouched because only
 * generated string values need this database-safe repair.
 */
function normalizeStepContentEntry([key, value]: [string, unknown]): [string, unknown] {
  return [key, normalizeStepContentValue(value)];
}

/**
 * Recurses through array content so nested options, pairs, forms, and image
 * prompts follow the same JSONB-safe string contract as top-level fields.
 */
function normalizeStepContentArray(value: unknown[]): unknown[] {
  return value.map((item) => normalizeStepContentValue(item));
}

/**
 * Recurses through step-content objects without mutating the input object, which keeps
 * validation and normalization as separate operations.
 */
function normalizeStepContentObject(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).map((entry) => normalizeStepContentEntry(entry)));
}

/**
 * Walks step content and repairs only string leaves. Non-string JSON values are already safe
 * for Postgres and pass through unchanged.
 */
export function normalizeStepContentValue(value: unknown): unknown {
  if (typeof value === "string") {
    return normalizeStepContentString(value);
  }

  if (Array.isArray(value)) {
    return normalizeStepContentArray(value);
  }

  if (isJsonObject(value)) {
    return normalizeStepContentObject(value);
  }

  return value;
}
