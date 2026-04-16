import { type Locator, expect } from "@playwright/test";

/**
 * Open a dialog through its trigger without racing hydration.
 * Playwright can click before the dialog wiring is ready, so this helper
 * retries until the dialog is visibly open instead of leaking that timing
 * detail into every browser test.
 */
export async function openDialog(trigger: Locator, dialog: Locator) {
  await expect(async () => {
    if (!(await dialog.isVisible())) {
      await trigger.click();
    }

    await expect(dialog).toBeVisible({ timeout: 1000 });
  }).toPass();
}
