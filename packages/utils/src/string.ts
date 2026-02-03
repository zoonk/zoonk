import slugify from "slugify";

const NUMERIC_ID_PATTERN = /^\d+$/;

export function removeAccents(str: string): string {
  return str.normalize("NFD").replaceAll(/[\u0300-\u036F]/g, "");
}

export function parseNumericId(value: string): number | null {
  if (!NUMERIC_ID_PATTERN.test(value)) {
    return null;
  }
  return Number.parseInt(value, 10);
}

export function normalizeString(str: string): string {
  return removeAccents(str).toLowerCase().replaceAll(/\s+/g, " ").trim();
}

export function toSlug(str: string): string {
  return slugify(str, { lower: true, strict: true });
}

/**
 * Formats a 0-indexed position as a 2-digit display string.
 * @example formatPosition(0) // "01"
 * @example formatPosition(9) // "10"
 */
export function formatPosition(position: number): string {
  return String(position + 1).padStart(2, "0");
}
