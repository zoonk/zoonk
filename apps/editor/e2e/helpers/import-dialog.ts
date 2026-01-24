import { type Page, expect } from "../fixtures";

export function getMoreOptionsButton(page: Page) {
  return page.getByRole("button", { name: /more options/i }).first();
}

export async function importFlow(page: Page, importFile: string, mode: "merge" | "replace") {
  await getMoreOptionsButton(page).click();
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
  } else {
    await dialog.getByText(/replace \(remove existing first\)/i).click();
  }

  await dialog.getByRole("button", { name: /^import$/i }).click();
  await expect(dialog).not.toBeVisible();
}
