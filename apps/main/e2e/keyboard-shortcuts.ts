import { type Page, expect } from "./fixtures";

/**
 * Shortcut listeners hydrate after server-rendered links are already visible,
 * so tests retry the key press instead of relying on a fixed delay that would
 * make the assertion slower and less reliable.
 */
export async function pressShortcutAndWaitForUrl({
  expectedUrl,
  key,
  page,
}: {
  expectedUrl: RegExp | string;
  key: string;
  page: Page;
}) {
  await expect(async () => {
    await page.keyboard.press(key);
    await expect(page).toHaveURL(expectedUrl, { timeout: 1000 });
  }).toPass({ timeout: 5000 });
}
