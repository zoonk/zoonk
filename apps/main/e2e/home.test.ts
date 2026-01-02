import { expect, test } from "@zoonk/e2e/fixtures";

const HEADING_LEARN_ANYTHING = /learn anything with ai/i;
const TEXT_CONTINUE_LEARNING = /continue learning/i;
const URL_LEARN = /\/learn/;
const URL_COURSES = /\/courses/;
const URL_PT = /\/pt/;

test.describe("Home Page - Unauthenticated", () => {
  test("shows hero section with headline and CTAs", async ({ page }) => {
    await page.goto("/");

    const hero = page.getByRole("main");

    await expect(
      hero.getByRole("heading", { name: HEADING_LEARN_ANYTHING }),
    ).toBeVisible();

    await expect(
      hero.getByRole("link", { exact: true, name: "Learn anything" }),
    ).toBeVisible();

    await expect(
      hero.getByRole("link", { exact: true, name: "Explore courses" }),
    ).toBeVisible();
  });

  test("navigates to learn page from CTA", async ({ page }) => {
    await page.goto("/");

    const hero = page.getByRole("main");
    await hero
      .getByRole("link", { exact: true, name: "Learn anything" })
      .click();
    await expect(page).toHaveURL(URL_LEARN);
  });

  test("navigates to courses page from CTA", async ({ page }) => {
    await page.goto("/");

    const hero = page.getByRole("main");
    await hero
      .getByRole("link", { exact: true, name: "Explore courses" })
      .click();
    await expect(page).toHaveURL(URL_COURSES);
  });

  test("loads Portuguese locale", async ({ page }) => {
    await page.goto("/pt");
    await expect(page).toHaveURL(URL_PT);
  });
});

test.describe("Home Page - Authenticated", () => {
  test("shows continue learning section", async ({ userWithProgress }) => {
    await userWithProgress.goto("/");

    await expect(
      userWithProgress.getByText(TEXT_CONTINUE_LEARNING),
    ).toBeVisible({ timeout: 10_000 });
  });
});
