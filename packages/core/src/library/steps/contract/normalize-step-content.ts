import { mapJsonStrings } from "@zoonk/utils/json";
import { replaceEmDashes } from "@zoonk/utils/string";

const malformedJsonBackslashEscape = "\u00005c";
const postgresUnsupportedNullCharacter = "\u0000";

/**
 * Repairs malformed JSON escapes that models sometimes emit when they meant a
 * literal backslash for LaTeX, then removes any remaining NULs because
 * PostgreSQL JSONB cannot store U+0000 inside text values. Em dashes, which
 * the app's copy never uses, go too, in lessons already stored as well (an OAB
 * lesson read "statement of defense — the written defense").
 */
function normalizeStepContentString(value: string): string {
  return replaceEmDashes(
    value
      .replaceAll(malformedJsonBackslashEscape, "\\")
      .replaceAll(postgresUnsupportedNullCharacter, ""),
  );
}

/**
 * Walks step content and repairs only string leaves. Non-string JSON values are already safe
 * for Postgres and pass through unchanged.
 */
export function normalizeStepContentValue(value: unknown): unknown {
  return mapJsonStrings(value, normalizeStepContentString);
}
