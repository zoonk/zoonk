export function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

  return parseJsonNumber(value);
}

/**
 * Accepts both real JSON numbers and stringified numbers because third-party
 * libraries sometimes expose response metadata as strings even when callers
 * need to compare it as a number.
 */
function parseJsonNumber(value: unknown): number | null {
  const parsed = getJsonNumberCandidate(value);

  return parsed !== null && Number.isFinite(parsed) ? parsed : null;
}

/**
 * Converts the supported JSON value shapes into a number candidate first, so
 * validation stays in one place and each input type only handles normalization.
 */
function getJsonNumberCandidate(value: unknown): number | null {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  return Number(normalized);
}
