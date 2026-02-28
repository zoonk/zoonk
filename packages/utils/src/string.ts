import { NAME_PLACEHOLDER } from "@zoonk/utils/constants";
import slug from "slug";

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

export function parseBigIntId(value: string): bigint | null {
  if (!NUMERIC_ID_PATTERN.test(value)) {
    return null;
  }
  return BigInt(value);
}

export function normalizeString(str: string): string {
  return removeAccents(str).toLowerCase().replaceAll(/\s+/g, " ").trim();
}

export function toSlug(str: string): string {
  return slug(str);
}

/**
 * Formats a 0-indexed position as a 2-digit display string.
 * @example formatPosition(0) // "01"
 * @example formatPosition(9) // "10"
 */
export function formatPosition(position: number): string {
  return String(position + 1).padStart(2, "0");
}

export function emptyToNull(value?: string | null): string | null {
  return value?.trim() || null;
}

export function ensureLocaleSuffix(value: string, language: string): string {
  if (language === "en") {
    return value;
  }

  const suffix = `-${language}`;

  if (value.endsWith(suffix)) {
    return value;
  }

  return `${value}${suffix}`;
}

export function replaceNamePlaceholder(text: string, name: string | null): string {
  if (!text.includes(NAME_PLACEHOLDER)) {
    return text;
  }

  if (name) {
    return text.replaceAll(NAME_PLACEHOLDER, name);
  }

  return text
    .replaceAll(/\{\{NAME\}\},\s*/g, "")
    .replaceAll(/,\s*\{\{NAME\}\}/g, "")
    .replaceAll(NAME_PLACEHOLDER, "")
    .trim();
}
