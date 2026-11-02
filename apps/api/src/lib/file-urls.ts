import { API_URL, MAIN_URL } from "@zoonk/utils/url";
import { toOwnFileUrl } from "@zoonk/utils/user-blobs";

const OWN_FILES_URL = `${API_URL}/v1/files`;

const IMAGE_URL_KEYS = new Set(["image", "imageUrl", "logo", "thumbnailUrl"]);

function isRootRelative(url: string): boolean {
  return url.startsWith("/") && !url.startsWith("//");
}

export function toApiImageUrl(url: string): string {
  const fileUrl = toOwnFileUrl({ baseUrl: OWN_FILES_URL, url });
  return isRootRelative(fileUrl) ? new URL(fileUrl, MAIN_URL).toString() : fileUrl;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function rewriteEntry([key, value]: [string, unknown]): [string, unknown] {
  if (typeof value === "string" && IMAGE_URL_KEYS.has(key)) {
    return [key, toApiImageUrl(value)];
  }

  if (key === "image" && isPlainObject(value) && typeof value.url === "string") {
    return [key, { ...rewriteObject(value), url: toApiImageUrl(value.url) }];
  }

  return [key, rewriteImages(value)];
}

function rewriteObject(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).map((entry) => rewriteEntry(entry)));
}

function rewriteImages(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => rewriteImages(item));
  }

  return isPlainObject(value) ? rewriteObject(value) : value;
}

/** Every route that returns stored images sends its body through this, so clients can load them. */
export function withApiImageUrls(body: unknown): unknown {
  return rewriteImages(body);
}
