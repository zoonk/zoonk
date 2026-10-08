import { API_URL, MAIN_URL } from "@zoonk/utils/url";
import { toOwnFileUrl } from "@zoonk/utils/user-blobs";

const OWN_FILES_URL = `${API_URL}/v1/files`;

/** Keys whose string value is an image's address. */
const IMAGE_URL_KEYS = new Set(["image", "imageUrl", "logo", "thumbnailUrl"]);

/** A path on the web app's own origin, such as a seeded course's cover (`/catalog/chapters/…`). */
function isRootRelative(url: string): boolean {
  return url.startsWith("/") && !url.startsWith("//");
}

/**
 * A stored image's address for API clients, which have no page to resolve a path against: a public
 * file keeps its CDN URL, a private picture points at `GET /v1/files/...` (only its owner can read
 * it), and a path the web app serves from its own origin gets that origin.
 */
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

  // A screen's or a question's picture: `{ url, alt, ... }`.
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

/**
 * A response body whose every image API clients can open (`toApiImageUrl`), wherever it nests
 * them: course covers (`imageUrl`), organization logos and profile pictures, the pictures of
 * screens and questions (`image.url`) and a mind map's small copy (`image.thumbnailUrl`). Every
 * route that returns stored images sends its body through it, so a client never gets a path it
 * can't load.
 */
export function withApiImageUrls(body: unknown): unknown {
  return rewriteImages(body);
}
