import { OWN_FILES_WEB_PATH, getPrivateBlobPathname, toOwnFileUrl } from "@zoonk/utils/user-blobs";

/** Where the browser loads a map's picture: the CDN, or main's file route for a private one. */
export function toMindMapSrc(url: string): string {
  return toOwnFileUrl({ baseUrl: OWN_FILES_WEB_PATH, url });
}

/**
 * A link that saves the picture instead of opening it: a private file comes from main's own origin,
 * where `download` works; the CDN saves a public one when asked with `?download=1`.
 */
export function toMindMapDownloadHref(url: string): string {
  return getPrivateBlobPathname(url) ? toMindMapSrc(url) : `${url}?download=1`;
}

/** The saved file's name: the map's title in plain lowercase words. */
export function toMindMapFileName(title: string): string {
  const words = title
    .normalize("NFD")
    .replaceAll(/\p{M}/gu, "")
    .toLowerCase()
    .match(/[\p{L}\p{N}]+/gu);

  return `${(words ?? ["mind-map"]).join("-")}.webp`;
}
