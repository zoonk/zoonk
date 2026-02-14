import { type Locator, expect } from "@playwright/test";

/**
 * Click a dialog trigger and wait for the dialog to open.
 * Retries the click if the dialog doesn't appear (handles pre-hydration timing).
 * Uses a visibility guard to avoid toggling the dialog closed on retry.
 */
export async function openDialog(trigger: Locator, dialog: Locator) {
  await expect(async () => {
    if (!(await dialog.isVisible())) {
      await trigger.click();
    }
    await expect(dialog).toBeVisible({ timeout: 1000 });
  }).toPass();
}
