import { type Page, expect } from "@playwright/test";

/**
 * Opens the Cmd/Ctrl+K palette from anywhere in the app (no bar has a search button), retried
 * until the client has hydrated the shortcut. `name` is the palette's title in the page's language.
 */
export async function openPaletteWithKeyboard(page: Page, name: RegExp | string = "Search") {
  const palette = page.getByRole("dialog", { name });

  await expect(async () => {
    await page.keyboard.press("ControlOrMeta+k");
    await expect(palette).toBeVisible({ timeout: 1000 });
  }).toPass();

  return palette;
}
