import { type Page, expect } from "../fixtures";

function getMoreOptionsButton(page: Page) {
  return page.getByRole("button", { name: /more options/i }).first();
}

export async function openMoreOptionsMenu(page: Page) {
  const trigger = getMoreOptionsButton(page);
  const menuItem = page.getByRole("menuitem", { name: /import/i });

  await expect(async () => {
    if (!(await menuItem.isVisible())) {
      await trigger.click();
    }
    await expect(menuItem).toBeVisible({ timeout: 1000 });
  }).toPass();
}

export async function importFlow(page: Page, importFile: string, mode: "merge" | "replace") {
  await openMoreOptionsMenu(page);
  await page.getByRole("menuitem", { name: /import/i }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    dialog.getByText(/drop file or click to select/i).click(),
  ]);

  await fileChooser.setFiles(importFile);

  if (mode === "merge") {
    await expect(dialog.getByLabel(/merge/i)).toBeChecked();
    await dialog.getByRole("button", { name: /^import$/i }).click();
  } else {
    await dialog.getByText(/replace \(remove existing first\)/i).click();
    await dialog.getByRole("button", { name: /replace all/i }).click();
  }

  await expect(dialog).not.toBeVisible();
}
