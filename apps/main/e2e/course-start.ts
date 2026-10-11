import { type Page } from "./fixtures";

/**
 * On a whole course's start page, where every start of a course asks the learner's level before
 * anything exists: "The basics", then Start.
 */
export async function startCourseWithLevel(page: Page) {
  await page.getByRole("radio", { name: /^The basics/u }).click();
  await page.getByRole("button", { name: "Start this course" }).click();
}
