import { type Page, expect } from "@playwright/test";

/**
 * Presses Cmd/Ctrl+K and says whether the app took it: its handlers prevent the shortcut's default
 * once the client has hydrated them, and a press they took opens the palette even while its code is
 * still loading.
 */
async function pressPaletteShortcut(page: Page): Promise<boolean> {
  const press = await page.evaluateHandle(() => ({
    taken: new Promise<boolean>((resolve) => {
      function onKeyDown(event: KeyboardEvent) {
        if (event.key.toLowerCase() !== "k") {
          return;
        }

        globalThis.removeEventListener("keydown", onKeyDown, true);

        // Read once every handler has run.
        setTimeout(() => resolve(event.defaultPrevented), 0);
      }

      globalThis.addEventListener("keydown", onKeyDown, true);
    }),
  }));

  try {
    await page.keyboard.press("ControlOrMeta+k");
    return await press.evaluate((pending) => pending.taken);
  } finally {
    await press.dispose();
  }
}

/**
 * Opens the Cmd/Ctrl+K palette from anywhere in the app (no bar has a search button), pressing the
 * shortcut again only while the client hasn't hydrated it: it toggles the palette, so pressing it
 * after the app took it would close a palette still on its way. `name` is the palette's title in
 * the page's language.
 */
export async function openPaletteWithKeyboard(page: Page, name: RegExp | string = "Search") {
  const palette = page.getByRole("dialog", { name });

  await expect(async () => {
    expect(await pressPaletteShortcut(page)).toBe(true);
  }).toPass();

  await expect(palette).toBeVisible();
  return palette;
}
