import slugify from "slugify";

const NUMERIC_ID_PATTERN = /^\d+$/;

export function removeAccents(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036F]/g, "");
}

export function parseNumericId(value: string): number | null {
  if (!NUMERIC_ID_PATTERN.test(value)) {
    return null;
  }
  return Number.parseInt(value, 10);
}

export function normalizeString(str: string): string {
  return removeAccents(str).toLowerCase().replace(/\s+/g, " ").trim();
}

export function toSlug(str: string): string {
  return slugify(str, { lower: true, strict: true });
}
