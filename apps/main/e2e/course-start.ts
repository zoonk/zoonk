import { type Page, expect } from "./fixtures";
import { expectHydrated } from "./hydration";

export async function startCourseWithLevel(page: Page) {
  const level = page.getByRole("radio", { name: /^The basics/u });
  await expectHydrated(level);
  await level.click();
  await expect(level).toBeChecked();
  await page.getByRole("button", { name: "Build my plan" }).click();
}
