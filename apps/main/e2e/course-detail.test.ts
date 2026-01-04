import { expect, test } from "./fixtures";

test.describe("Course Detail Page", () => {
  test("shows course content with title, description, and image", async ({
    page,
  }) => {
    await page.goto("/b/ai/c/machine-learning");

    await expect(
      page.getByRole("heading", { name: /machine learning/i }),
    ).toBeVisible();

    await expect(page.getByText(/patterns|predictions|data/i)).toBeVisible();

    const courseImage = page.getByRole("img", { name: /machine learning/i });
    await expect(courseImage).toBeVisible();
  });

  test("non-existent course shows 404 page", async ({ page }) => {
    await page.goto("/b/ai/c/nonexistent-course");

    await expect(page.getByText(/not found|404/i)).toBeVisible();
  });

  test("shows fallback icon when course has no image", async ({ page }) => {
    await page.goto("/b/ai/c/python-programming");

    await expect(
      page.getByRole("heading", { name: /python programming/i }),
    ).toBeVisible();

    // Fallback icon should have role="img" with the course title as aria-label
    // This distinguishes it from actual images which use <img> elements
    const fallbackIcon = page
      .getByRole("img", { name: /python programming/i })
      .first();
    await expect(fallbackIcon).toBeVisible();
    await expect(fallbackIcon).not.toHaveAttribute("src");
  });
});

test.describe("Course Detail Page - Locale", () => {
  test("navigating from Portuguese courses page preserves locale", async ({
    page,
  }) => {
    await page.goto("/pt/courses");

    await page
      .getByRole("link", { name: /machine learning/i })
      .first()
      .click();

    await expect(page).toHaveURL(/\/pt\/b\/ai\/c\/machine-learning/);

    await expect(
      page.getByText(/permite que computadores identifiquem/i).first(),
    ).toBeVisible();
  });
});
