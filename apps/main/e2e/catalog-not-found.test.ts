import { expect, test } from "./fixtures";

const MISSING_COURSE = "/b/zoonk/c/no-course-with-this-slug";

test("offers the course catalog as the main action when a visitor opens a missing course", async ({
  page,
}) => {
  await page.goto(MISSING_COURSE);

  await expect(page.getByRole("heading", { name: "We couldn't find this page" })).toBeVisible();

  await expect(
    page.locator('[data-slot="bottom-bar"]').getByRole("link", { name: "Explore courses" }),
  ).toHaveAttribute("href", "/courses");

  await expect(page.getByRole("link", { name: "Go to Today" })).toHaveCount(0);
});

test("offers Today as the main action when a learner opens a missing course", async ({
  userWithoutProgress: page,
}) => {
  await page.goto(MISSING_COURSE);

  await expect(page.getByRole("link", { name: "Go to Today" })).toHaveAttribute("href", "/today");
});

test("offers a learner Today on the missing course's first paint, before its scripts load", async ({
  userWithoutProgress: page,
}) => {
  await page.route("**/_next/static/chunks/**", (route) => route.abort());
  await page.goto(MISSING_COURSE);

  const bar = page.locator('[data-slot="bottom-bar"]');

  await expect(bar.getByRole("link", { name: "Go to Today" })).toBeVisible();
  await expect(bar.getByRole("link", { name: "Explore courses" })).toHaveCount(0);
});
