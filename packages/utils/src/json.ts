export type JsonObject = { [key: string]: JsonValue };
type JsonValue = JsonObject | JsonValue[] | boolean | null | number | string;

/**
 * Narrows unknown JSON-like values to keyed objects so callers can safely read
 * named fields without accidentally treating arrays as records.
 */
export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validates optional string fields at untrusted boundaries so each consumer
 * does not need to recreate the same undefined-or-string check.
 */
export function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

export function getString(body: unknown, key: string): string | null {
  if (!isJsonObject(body) || !(key in body)) {
    return null;
  }

  const value = body[key];

  return typeof value === "string" ? value : null;
}

/**
 * Reads numeric fields from unknown JSON-like values without forcing callers to
 * cast an object shape before the runtime value has proven it contains a number
 * or a numeric string.
 */
export function getNumber(body: unknown, key: string): number | null {
  if (!isJsonObject(body) || !(key in body)) {
    return null;
  }

  const value = body[key];

  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Converts an unknown value into searchable text while staying tolerant of
 * unserializable objects. Nullish and unsupported values return an empty string
 * so callers can compose multiple fields without special cases.
 */
export function stringifyUnknown(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  try {
    const json = JSON.stringify(value);

    return typeof json === "string" ? json : "";
  } catch {
    return "";
  }
}

/**
 * Rewrites every string inside a JSON-like value (objects and arrays at any depth) and keeps keys
 * and other values, without changing the input, for repairs that apply to all generated text.
 */
export function mapJsonStrings(value: unknown, rewrite: (text: string) => string): unknown {
  if (typeof value === "string") {
    return rewrite(value);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => mapJsonStrings(entry, rewrite));
  }

  if (isJsonObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, mapJsonStrings(entry, rewrite)]),
    );
  }

  return value;
}
