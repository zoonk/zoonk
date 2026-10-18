import {
  type PreviewEntry,
  type PreviewState,
  getPreviewEntry,
  previewEntries,
} from "@zoonk/player/preview/catalog";

type SearchParams = Record<string, string | string[] | undefined>;

export const PREVIEW_DEVICES = ["phone", "desktop"] as const;

export type GallerySelection = {
  device: (typeof PREVIEW_DEVICES)[number];
  entry: PreviewEntry;
  state: PreviewState;
};

export function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** A value from the URL when it's one the gallery knows, so a hand-edited link still opens. */
export function readOption<Value extends string>(
  allowed: readonly Value[],
  value: string | string[] | undefined,
): Value | undefined {
  const first = readParam(value);
  return allowed.find((option) => option === first);
}

/**
 * The screen, state and device from the URL: an unknown screen opens the first one, and a
 * state the screen doesn't have opens its first state.
 */
export function parseGallery(params: SearchParams): GallerySelection | null {
  const entry = getPreviewEntry(readParam(params.entry) ?? "") ?? previewEntries[0];
  const state = entry ? (readOption(entry.states, params.state) ?? entry.states[0]) : undefined;

  if (!entry || !state) {
    return null;
  }

  return { device: readOption(PREVIEW_DEVICES, params.device) ?? "phone", entry, state };
}

/** A gallery link keeps the device, so screens compare side by side as they change. */
export function galleryHref({
  device,
  entry,
  state,
}: Pick<GallerySelection, "device"> & { entry: string; state?: PreviewState }) {
  const query = new URLSearchParams({ device, entry, ...(state ? { state } : {}) });
  return `/?${query.toString()}`;
}

/** The bare screen the gallery shows in a frame, which also opens alone at the window's size. */
export function previewHref({ entry, state }: { entry: string; state: PreviewState }) {
  return `/preview?${new URLSearchParams({ entry, state }).toString()}`;
}
