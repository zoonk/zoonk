import { expect, test } from "./fixtures";

test.describe("Lesson Detail Page", () => {
  test("shows lesson content with title, description, and position", async ({ page }) => {
    await page.goto(
      "/b/ai/c/machine-learning/ch/introduction-to-machine-learning/l/what-is-machine-learning",
    );

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /What is Machine Learning\?/i,
      }),
    ).toBeVisible();

    await expect(
      page.getByText(
        /Learn what machine learning is and how it differs from traditional programming/i,
      ),
    ).toBeVisible();

    const positionIcon = page.getByRole("img", { name: /lesson 01/i });
    await expect(positionIcon).toBeVisible();
  });

  test("non-existent lesson shows 404 page", async ({ page }) => {
    await page.goto(
      "/b/ai/c/machine-learning/ch/introduction-to-machine-learning/l/nonexistent-lesson",
    );

    await expect(page.getByText(/not found|404/i)).toBeVisible();
  });

  test("unpublished lesson shows 404 page", async ({ page }) => {
    await page.goto(
      "/b/ai/c/machine-learning/ch/introduction-to-machine-learning/l/types-of-learning",
    );

    await expect(page.getByText(/not found|404/i)).toBeVisible();
  });

  test("clicking links in popover navigates correctly", async ({ page }) => {
    await page.goto(
      "/b/ai/c/machine-learning/ch/introduction-to-machine-learning/l/what-is-machine-learning",
    );

    const triggerButton = page.getByRole("button", {
      name: /What is Machine Learning\?/i,
    });
    await triggerButton.click();

    // Verify course link is visible
    await expect(page.getByRole("link", { name: /^Machine Learning$/i })).toBeVisible();

    // Verify chapter link is visible
    await expect(
      page.getByRole("link", { name: /Introduction to Machine Learning/i }),
    ).toBeVisible();

    // Click the course link
    const courseLink = page.getByRole("link", { name: /^Machine Learning$/i });
    await courseLink.click({ force: true });

    // Verify URL is correct
    await expect(page).toHaveURL(/\/b\/ai\/c\/machine-learning$/);

    // Verify we're on the course page
    await expect(page.getByRole("heading", { level: 1, name: /Machine Learning/i })).toBeVisible();
  });

  test("displays activity list with titles and descriptions", async ({ page }) => {
    await page.goto(
      "/b/ai/c/machine-learning/ch/introduction-to-machine-learning/l/what-is-machine-learning",
    );

    // Scope to the activity list for precise queries
    const activityList = page.getByRole("list", { name: /activities/i });

    await expect(activityList.getByRole("link", { name: /background/i })).toBeVisible();
    await expect(activityList.getByText(/explains why this topic exists/i)).toBeVisible();

    await expect(activityList.getByRole("link", { name: /explanation/i })).toBeVisible();
    await expect(activityList.getByText(/explains what this topic is/i)).toBeVisible();

    await expect(activityList.getByRole("link", { name: /quiz/i })).toBeVisible();
    await expect(activityList.getByText(/tests your understanding/i)).toBeVisible();

    await expect(activityList.getByRole("link", { name: /challenge/i })).toBeVisible();
    await expect(activityList.getByText(/tests analytical thinking/i)).toBeVisible();
  });

  test("clicking activity link navigates to activity page", async ({ page }) => {
    await page.goto(
      "/b/ai/c/machine-learning/ch/introduction-to-machine-learning/l/what-is-machine-learning",
    );

    // Scope to the activity list for precise query
    const activityList = page.getByRole("list", { name: /activities/i });
    const activityLink = activityList.getByRole("link", { name: /background/i });
    await activityLink.click();

    await expect(page).toHaveURL(/\/l\/what-is-machine-learning\/a\/0/);
  });

  test("lesson without activities redirects to generate page", async ({ page }) => {
    await page.goto("/b/ai/c/machine-learning/ch/data-preparation/l/understanding-datasets");

    await expect(page).toHaveURL(/\/generate\/l\/\d+/);
  });
});
