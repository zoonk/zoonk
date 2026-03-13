const NUMERIC_ID_PATTERN = /^\d+$/;

export function validateOffset(value?: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}

export function parseNumericId(value: string): number | null {
  if (!NUMERIC_ID_PATTERN.test(value)) {
    return null;
  }
  return Number.parseInt(value, 10);
}

export function parseBigIntId(value: string): bigint | null {
  if (!NUMERIC_ID_PATTERN.test(value)) {
    return null;
  }
  return BigInt(value);
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
