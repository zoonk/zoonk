import { type Page } from "./fixtures";

export async function startCourseWithLevel(page: Page) {
  await page.getByRole("radio", { name: /^The basics/u }).click();
  await page.getByRole("button", { name: "Build my plan" }).click();
}
