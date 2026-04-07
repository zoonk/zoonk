import { isJsonObject } from "@zoonk/utils/json";

/**
 * Extracts an array field from a JSON-like object for test assertions.
 * Returns an empty array if the key is missing or not an array.
 * Each element is narrowed to a Record via isJsonObject — non-object
 * elements are filtered out.
 */
export function getArray(body: unknown, key: string): Record<string, unknown>[] {
  if (!isJsonObject(body) || !Array.isArray(body[key])) {
    return [];
  }

  const arr: unknown[] = body[key];
  return arr.filter((item) => isJsonObject(item));
}
