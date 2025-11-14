const MIN_SLUG_LENGTH = 2;
const MAX_SLUG_LENGTH = 63;

// Must match: lowercase letters, numbers, hyphens only
// Cannot start or end with hyphen
const SLUG_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

/**
 * Validates if a slug contains only safe characters (lowercase letters, numbers, hyphens).
 * No dots allowed. Hyphens cannot be at the start or end.
 */
export function isValidSlug(slug: string): boolean {
  if (!slug || slug.length === 0) {
    return false;
  }

  // Check length limits (reasonable for URLs)
  if (slug.length < MIN_SLUG_LENGTH || slug.length > MAX_SLUG_LENGTH) {
    return false;
  }

  return SLUG_PATTERN.test(slug);
}

/**
 * Converts a string to a valid slug format.
 * Converts to lowercase, removes accents, replaces spaces with hyphens,
 * removes invalid characters, and ensures no leading/trailing hyphens.
 */
export function toSlug(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/[^a-z0-9-]/g, "") // Remove invalid characters
    .replace(/-+/g, "-") // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
}
