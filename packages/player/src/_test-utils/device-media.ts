import { commands } from "vitest/browser";

/**
 * The device's light or dark scheme and its reduced-motion setting: media features a page can
 * read but not change, so tests ask the browser's driver for them (Playwright's
 * `page.emulateMedia`, registered as the `emulateMedia` command in vitest.config.mts).
 */
export type DeviceMedia = {
  colorScheme?: "dark" | "light";
  reducedMotion?: "no-preference" | "reduce";
};

declare module "vitest/browser" {
  // oxlint-disable-next-line typescript/consistent-type-definitions -- Only an interface merges.
  interface BrowserCommands {
    emulateMedia: (media: DeviceMedia) => Promise<void>;
  }
}

/** How every test finds the device: light, with no motion preference. */
const DEVICE_DEFAULTS: Required<DeviceMedia> = {
  colorScheme: "light",
  reducedMotion: "no-preference",
};

/**
 * Plays on a device with these media features, then puts the device back for the next test: the
 * setting belongs to the browser page, which outlives the test.
 */
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
