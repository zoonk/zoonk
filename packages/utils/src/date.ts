export const MS_PER_DAY = 86_400_000;
export const EPOCH_YEAR = 1970;
export const FIRST_SUNDAY_OFFSET = 4;

// Intentionally no calendar validation (e.g., month 0-12, Feb 30).
// Zod regex ensures digit format; Date.UTC silently rolls over edge cases
// (e.g., Feb 31 → Mar 3), which the server bounds check catches.
export function parseLocalDate(dateString: string): Date {
  const parts = dateString.split("-").map(Number);
  return new Date(Date.UTC(parts[0] ?? 0, (parts[1] ?? 1) - 1, parts[2] ?? 1));
}

/**
 * Normalizes date values that may already be serialized at an API boundary, so
 * callers can safely mix Prisma Date objects and auth/session strings in one
 * JSON response without special-casing each source.
 */
export function serializeDate(value?: Date | string | null): string | null {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : value;
}
