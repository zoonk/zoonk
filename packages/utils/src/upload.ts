export const DEFAULT_IMAGE_QUALITY = 80;

export function normalizeContentType(contentType: string): string {
  return contentType.split(";")[0]?.trim().toLowerCase() ?? "";
}
