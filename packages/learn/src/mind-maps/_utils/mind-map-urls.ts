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

export const MIND_MAP_TABS = ["chapters", "lessons", "saved"] as const;

export type MindMapTab = (typeof MIND_MAP_TABS)[number];

export function readMindMapTab(value: unknown): MindMapTab | null {
  return MIND_MAP_TABS.find((tab) => tab === value) ?? null;
}

export function buildMindMapsHref({ page, tab }: { page: string; tab: MindMapTab }): string {
  return `${page}?${new URLSearchParams({ tab }).toString()}`;
}

/** The map a deck opens on: a chapter's map, or one of its lesson maps. */
export type MindMapPlace = { chapterId: string; lessonId?: string | null };

export function buildStudyHref({
  place,
  study,
  view,
}: {
  place?: MindMapPlace | null;
  study: string;
  view: MindMapTab;
}): string {
  const params = new URLSearchParams([
    ["view", view],
    ...(place ? [["at", place.chapterId]] : []),
    ...(place?.lessonId ? [["lesson", place.lessonId]] : []),
  ]);

  return `${study}?${params.toString()}`;
}
