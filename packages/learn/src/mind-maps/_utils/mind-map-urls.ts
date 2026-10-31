import { OWN_FILES_WEB_PATH, getPrivateBlobPathname, toOwnFileUrl } from "@zoonk/utils/user-blobs";

export function toMindMapSrc(url: string): string {
  return toOwnFileUrl({ baseUrl: OWN_FILES_WEB_PATH, url });
}

/** `download` only works on main's own origin, so a public file asks the CDN with `?download=1`. */
export function toMindMapDownloadHref(url: string): string {
  return getPrivateBlobPathname(url) ? toMindMapSrc(url) : `${url}?download=1`;
}

export function toMindMapFileName(title: string): string {
  const words = title
    .normalize("NFD")
    .replaceAll(/\p{M}/gu, "")
    .toLowerCase()
    .match(/[\p{L}\p{N}]+/gu);

  return `${(words ?? ["mind-map"]).join("-")}.webp`;
}
