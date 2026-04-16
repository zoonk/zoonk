const NUMERIC_ID_PATTERN = /^\d+$/;

export function validateOffset(value?: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}

/**
 * Route params and form values often arrive as strings, while some call sites
 * already have an integer in hand. This parser accepts both shapes so callers
 * can ask for a numeric id directly instead of reimplementing trim/validation
 * branches around it.
 */
export function parseNumericId(value?: number | string | null): number | null {
  if (typeof value === "number") {
    return Number.isInteger(value) && value >= 0 ? value : null;
  }

  const normalizedValue = value?.trim();

  if (!normalizedValue || !NUMERIC_ID_PATTERN.test(normalizedValue)) {
    return null;
  }

  return Number.parseInt(normalizedValue, 10);
}

/**
 * Formats a 0-indexed position as a 2-digit display string.
 * @example formatPosition(0) // "01"
 * @example formatPosition(9) // "10"
 */
export function formatPosition(position: number): string {
  return String(position + 1).padStart(2, "0");
}

export function sumOf(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}
