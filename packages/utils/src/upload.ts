export const DEFAULT_IMAGE_QUALITY = 80;

/** A media type without its parameters, lowercased: "Text/HTML; charset=UTF-8" is "text/html". */
export function normalizeContentType(contentType: string): string {
  return contentType.split(";")[0]?.trim().toLowerCase() ?? "";
}
