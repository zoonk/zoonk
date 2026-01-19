import { expect, test } from "./fixtures";

test.describe("Lesson Detail Page", () => {
  test("shows lesson content with title, description, and position", async ({
    page,
  }) => {
    await page.goto(
      "/b/ai/c/machine-learning/c/introduction-to-machine-learning/l/what-is-machine-learning",
    );

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /what is machine learning/i,
      }),
    ).toBeVisible();

    await expect(
      page.getByText(/differs from traditional programming/i).first(),
    ).toBeVisible();

    const positionIcon = page.getByRole("img", { name: /lesson 01/i }).first();
    await expect(positionIcon).toBeVisible();
  });

  test("non-existent lesson shows 404 page", async ({ page }) => {
    await page.goto(
      "/b/ai/c/machine-learning/c/introduction-to-machine-learning/l/nonexistent-lesson",
    );

    await expect(page.getByText(/not found|404/i)).toBeVisible();
  });

  test("unpublished lesson shows 404 page", async ({ page }) => {
    await page.goto(
      "/b/ai/c/machine-learning/c/introduction-to-machine-learning/l/types-of-learning",
    );

    await expect(page.getByText(/not found|404/i)).toBeVisible();
  });

  test("clicking course link in popover navigates to course page", async ({
    page,
  }) => {
    await page.goto(
      "/b/ai/c/machine-learning/c/introduction-to-machine-learning/l/what-is-machine-learning",
    );

    const triggerButton = page.getByRole("button", {
      name: /what is machine learning/i,
    });
    await triggerButton.click();

    await expect(
      page.getByRole("link", { name: /machine learning/i }),
    ).toBeVisible();

    await expect(
      page.getByText(/introduction to machine learning/i),
    ).toBeVisible();

    const courseLink = page.getByRole("link", { name: /machine learning/i });
    await courseLink.click({ force: true });

    await expect(page).toHaveURL(/\/b\/ai\/c\/machine-learning/);

    await expect(
      page.getByRole("heading", { level: 1, name: /machine learning/i }),
    ).toBeVisible();
  });

  test("displays activity list with titles and descriptions", async ({
    page,
  }) => {
    await page.goto(
      "/b/ai/c/machine-learning/c/introduction-to-machine-learning/l/what-is-machine-learning",
    );

    await expect(
      page.getByRole("link", { name: /background/i }).first(),
    ).toBeVisible();
    await expect(page.getByText(/the story behind this topic/i)).toBeVisible();

    await expect(
      page.getByRole("link", { name: /explanation/i }).first(),
    ).toBeVisible();
    await expect(
      page.getByText(/key concepts explained clearly/i),
    ).toBeVisible();

    await expect(
      page.getByRole("link", { name: /quiz/i }).first(),
    ).toBeVisible();
    await expect(
      page.getByText(/test your understanding/i).first(),
    ).toBeVisible();

    await expect(page.getByRole("link", { name: /challenge/i })).toBeVisible();
    await expect(page.getByText(/make strategic decisions/i)).toBeVisible();
  });

  test("clicking activity link navigates to activity page", async ({
    page,
  }) => {
    await page.goto(
      "/b/ai/c/machine-learning/c/introduction-to-machine-learning/l/what-is-machine-learning",
    );

    const activityLink = page
      .getByRole("link", { name: /background/i })
      .first();
    await activityLink.click();

    await expect(page).toHaveURL(/\/l\/what-is-machine-learning\/a\/0/);
  });

  test("lesson without activities redirects to generate page", async ({
    page,
  }) => {
    await page.goto(
      "/b/ai/c/machine-learning/c/data-preparation/l/understanding-datasets",
    );

    await expect(page).toHaveURL(/\/generate\/l\/\d+/);
    await expect(
      page.getByRole("heading", { name: /generate lesson activities/i }),
    ).toBeVisible();
  });
});
