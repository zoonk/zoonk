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

  test("handles course without image gracefully", async ({ page }) => {
    await page.goto("/b/ai/c/python-programming");

    await expect(
      page.getByRole("heading", { name: /python programming/i }),
    ).toBeVisible();
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
