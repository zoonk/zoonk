const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Prisma throws when a malformed id reaches a UUID column. This guard lets route
 * and form boundaries reject bad input early so callers can return `null` or
 * `notFound()` instead of crashing into a database error.
 *
 * @example isUuid("018f5c3e-a9f8-7cc9-88d4-31e5c7286210") // true
 * @example isUuid("invalid-id") // false
 */
export function isUuid(value: unknown): value is string {
  const normalizedValue = typeof value === "string" ? value.trim() : "";

  return UUID_PATTERN.test(normalizedValue);
}
