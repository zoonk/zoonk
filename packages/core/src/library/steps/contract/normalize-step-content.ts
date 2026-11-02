import { mapJsonStrings } from "@zoonk/utils/json";
import { replaceEmDashes } from "@zoonk/utils/string";

const malformedJsonBackslashEscape = "\u00005c";
const postgresUnsupportedNullCharacter = "\u0000";

/** PostgreSQL JSONB cannot store U+0000 in text values. */
function normalizeStepContentString(value: string): string {
  return replaceEmDashes(
    value
      .replaceAll(malformedJsonBackslashEscape, "\\")
      .replaceAll(postgresUnsupportedNullCharacter, ""),
  );
}

export function normalizeStepContentValue(value: unknown): unknown {
  return mapJsonStrings(value, normalizeStepContentString);
}
