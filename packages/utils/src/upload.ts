const BYTES_PER_MB = 1024 * 1024;

const DEFAULT_IMAGE_MAX_SIZE_MB = 5;
export const DEFAULT_IMAGE_MAX_SIZE = DEFAULT_IMAGE_MAX_SIZE_MB * BYTES_PER_MB;
export const DEFAULT_IMAGE_QUALITY = 80;
export const DEFAULT_IMAGE_ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/** A media type without its parameters, lowercased: "Text/HTML; charset=UTF-8" is "text/html". */
export function normalizeContentType(contentType: string): string {
  return contentType.split(";")[0]?.trim().toLowerCase() ?? "";
}
