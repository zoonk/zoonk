import { commands } from "vitest/browser";

export type DeviceMedia = {
  colorScheme?: "dark" | "light";
  contrast?: "more" | "no-preference";
  reducedMotion?: "no-preference" | "reduce";
};

declare module "vitest/browser" {
  // oxlint-disable-next-line typescript/consistent-type-definitions -- Only an interface merges.
  interface BrowserCommands {
    emulateMedia: (media: DeviceMedia) => Promise<void>;
  }
}

const DEVICE_DEFAULTS: Required<DeviceMedia> = {
  colorScheme: "light",
  contrast: "no-preference",
  reducedMotion: "no-preference",
};

/** Restores the media settings afterward because the browser page outlives the test. */
export async function onDevice<TResult>(
  media: DeviceMedia,
  play: () => Promise<TResult>,
): Promise<TResult> {
  await commands.emulateMedia(media);

  try {
    return await play();
  } finally {
    await commands.emulateMedia(DEVICE_DEFAULTS);
  }
}
