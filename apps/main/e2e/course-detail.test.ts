import { expect, test } from "@zoonk/e2e/fixtures";

test.describe("Course Detail Page", () => {
  test("shows course title", async ({ page }) => {
    await page.goto("/b/ai/c/machine-learning");

    await expect(
      page.getByRole("heading", { name: /machine learning/i }),
    ).toBeVisible();
  });

  test("shows course description", async ({ page }) => {
    await page.goto("/b/ai/c/machine-learning");

    // Machine Learning course has description about patterns, predictions, data
    await expect(page.getByText(/patterns|predictions|data/i)).toBeVisible();
  });

  test("shows course image when available", async ({ page }) => {
    await page.goto("/b/ai/c/machine-learning");

    // Machine Learning course has an image
    const courseImage = page.getByRole("img", { name: /machine learning/i });
    await expect(courseImage).toBeVisible();
  });

  test("shows organization/brand name", async ({ page }) => {
    await page.goto("/b/ai/c/machine-learning");

    // Should show the organization name "AI" or similar branding
    await expect(page.getByText(/ai/i)).toBeVisible();
  });

  test("non-existent course shows 404 page", async ({ page }) => {
    await page.goto("/b/ai/c/nonexistent-course");

    // Should show 404 or not found message
    await expect(page.getByText(/not found|404/i)).toBeVisible();
  });

  test("handles course without image gracefully", async ({ page }) => {
    // Python Programming course has no image (imageUrl: null in seed)
    await page.goto("/b/ai/c/python-programming");

    // Page should still load and show course content
    await expect(
      page.getByRole("heading", { name: /python programming/i }),
    ).toBeVisible();
  });
});

test.describe("Course Detail Page - Locale", () => {
  test("English course shows on /b/ai/c/machine-learning", async ({ page }) => {
    await page.goto("/b/ai/c/machine-learning");

    await expect(
      page.getByRole("heading", { name: /machine learning/i }),
    ).toBeVisible();
    // Description should be in English
    await expect(
      page.getByText(/enables computers to identify patterns/i),
    ).toBeVisible();
  });

  test("Portuguese course shows on /pt/b/ai/c/machine-learning", async ({
    page,
  }) => {
    await page.goto("/pt/b/ai/c/machine-learning");

    await expect(
      page.getByRole("heading", { name: /machine learning/i }),
    ).toBeVisible();
    // Description should be in Portuguese
    await expect(
      page.getByText(/permite que computadores identifiquem/i),
    ).toBeVisible();
  });

  test("navigating to course from Portuguese courses page shows Portuguese content", async ({
    page,
  }) => {
    await page.goto("/pt/courses");

    // Click on a Portuguese course link
    await page.getByRole("link", { name: /machine learning/i }).first().click();

    // Should be on Portuguese course detail page
    await expect(page).toHaveURL(/\/pt\/b\/ai\/c\/machine-learning/);

    // Verify Portuguese content is displayed (use first() since description appears in multiple places)
    await expect(
      page.getByText(/permite que computadores identifiquem/i).first(),
    ).toBeVisible();
  });
});
