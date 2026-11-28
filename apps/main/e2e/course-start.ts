import { type Page, expect } from "./fixtures";

/** A level picked before the page hydrates lands a moment later, and enables the button then. */
export async function startCourseWithLevel(
  page: Page,
  { button = "Build my plan", level = /^The basics/u }: { button?: string; level?: RegExp } = {},
) {
  const choice = page.getByRole("radio", { name: level });
  await choice.click();
  await expect(choice).toBeChecked();
  await page.getByRole("button", { name: button }).click();
}
