const ACCENTS_REGEX = /[\u0300-\u036f]/g;
const SLUG_VALID_CHARS_REGEX = /^[a-z0-9-]+$/;
const CONSECUTIVE_HYPHENS_REGEX = /--/;

export const MAX_SLUG_LENGTH = 100;

export function removeAccents(str: string): string {
  return str.normalize("NFD").replace(ACCENTS_REGEX, "");
}

export function normalizeString(str: string): string {
  return removeAccents(str).toLowerCase().replace(/\s+/g, " ").trim();
}

export type SlugValidationResult = {
  isValid: boolean;
  error?: string;
};

/**
 * Validates a slug string for URL usage.
 *
 * Rules:
 * - Must be at least 1 character
 * - Must be at most 100 characters
 * - Must only contain lowercase letters, numbers, and hyphens
 * - Cannot start or end with a hyphen
 * - Cannot have consecutive hyphens
 */
export function validateSlug(slug: string): SlugValidationResult {
  if (!slug || slug.length === 0) {
    return { error: "Slug cannot be empty", isValid: false };
  }

  if (slug.length > MAX_SLUG_LENGTH) {
    return {
      error: `Slug must be ${MAX_SLUG_LENGTH} characters or less`,
      isValid: false,
    };
  }

  if (!SLUG_VALID_CHARS_REGEX.test(slug)) {
    return {
      error: "Slug can only contain lowercase letters, numbers, and hyphens",
      isValid: false,
    };
  }

  if (slug.startsWith("-") || slug.endsWith("-")) {
    return { error: "Slug cannot start or end with a hyphen", isValid: false };
  }

  if (CONSECUTIVE_HYPHENS_REGEX.test(slug)) {
    return { error: "Slug cannot have consecutive hyphens", isValid: false };
  }

  return { isValid: true };
}
