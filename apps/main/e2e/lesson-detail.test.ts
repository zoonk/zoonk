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
});
