import { expect, test } from "./fixtures";

test.describe("Chapter Detail Page", () => {
  test("shows chapter content with title, description, and position", async ({ page }) => {
    await page.goto("/b/ai/c/machine-learning/ch/introduction-to-machine-learning");

    // Verify chapter heading is visible
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /Introduction to Machine Learning/i,
      }),
    ).toBeVisible();

    // Verify description is visible
    await expect(page.getByText(/different types of learning/i).first()).toBeVisible();

    // Verify position icon shows "01"
    const positionIcon = page.getByRole("img", { name: /chapter 01/i }).first();
    await expect(positionIcon).toBeVisible();
  });

  test("displays lessons list with position numbers", async ({ page }) => {
    await page.goto("/b/ai/c/machine-learning/ch/introduction-to-machine-learning");

    // Verify lesson titles are visible as links
    await expect(page.getByRole("link", { name: /What is Machine Learning\?/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /History of Machine Learning/i })).toBeVisible();

    // Unpublished lesson "Types of Learning" should NOT be visible
    await expect(page.getByRole("link", { name: /Types of Learning/i })).not.toBeVisible();
  });

  test("lesson link navigates to the correct URL", async ({ page }) => {
    await page.goto("/b/ai/c/machine-learning/ch/introduction-to-machine-learning");

    const lessonLink = page.getByRole("link", {
      name: /What is Machine Learning\?/i,
    });
    await expect(lessonLink).toBeVisible();

    await lessonLink.click();

    // Verify URL uses /ch/ pattern
    await expect(page).toHaveURL(
      /\/b\/ai\/c\/machine-learning\/ch\/introduction-to-machine-learning\/l\/what-is-machine-learning/,
    );
  });

  test("non-existent chapter shows 404 page", async ({ page }) => {
    await page.goto("/b/ai/c/machine-learning/ch/nonexistent-chapter");

    await expect(page.getByText(/not found|404/i)).toBeVisible();
  });

  test("unpublished chapter shows 404 page", async ({ page }) => {
    await page.goto("/b/ai/c/machine-learning/ch/tree-based-models");

    await expect(page.getByText(/not found|404/i)).toBeVisible();
  });

  test("clicking course link in popover navigates to course page", async ({ page }) => {
    await page.goto("/b/ai/c/machine-learning/ch/introduction-to-machine-learning");

    // Open the popover
    const triggerButton = page.getByRole("button", {
      name: /Introduction to Machine Learning/i,
    });
    await triggerButton.click();

    // Verify course link is visible in popover
    const courseLink = page.getByRole("link", { exact: true, name: "Machine Learning" });
    await expect(courseLink).toBeVisible();

    // Click the course link
    await courseLink.click({ force: true });

    // Verify URL is correct
    await expect(page).toHaveURL(/\/b\/ai\/c\/machine-learning$/);

    // Verify we're on the course page
    await expect(page.getByRole("heading", { level: 1, name: /Machine Learning/i })).toBeVisible();
  });
});

test.describe("Chapter Detail - Locale", () => {
  test("shows lessons in Portuguese for Portuguese locale", async ({ page }) => {
    await page.goto("/pt/b/ai/c/machine-learning/ch/introducao-ao-machine-learning");

    // Portuguese lesson titles should be visible
    await expect(page.getByRole("link", { name: /O que é Machine Learning\?/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /História do Machine Learning/i })).toBeVisible();
  });
});

test.describe("Chapter Lesson Search", () => {
  test("filters lessons by title", async ({ page }) => {
    await page.goto("/b/ai/c/machine-learning/ch/introduction-to-machine-learning");

    // Fill search input
    await page.getByLabel(/search lessons/i).fill("history");

    // Only matching lesson should be visible
    await expect(page.getByRole("link", { name: /History of Machine Learning/i })).toBeVisible();

    // Non-matching lessons should be hidden
    await expect(page.getByRole("link", { name: /What is Machine Learning\?/i })).not.toBeVisible();
  });

  test("shows empty state when no matches found", async ({ page }) => {
    await page.goto("/b/ai/c/machine-learning/ch/introduction-to-machine-learning");

    await page.getByLabel(/search lessons/i).fill("nonexistent xyz");

    await expect(page.getByText(/no lessons found/i)).toBeVisible();
  });

  test("clears search and shows all lessons again", async ({ page }) => {
    await page.goto("/b/ai/c/machine-learning/ch/introduction-to-machine-learning");

    // Search to filter
    const searchInput = page.getByLabel(/search lessons/i);
    await searchInput.fill("history");

    // Verify filtered
    await expect(page.getByRole("link", { name: /What is Machine Learning\?/i })).not.toBeVisible();

    // Clear search
    await searchInput.clear();

    // All lessons should be visible again
    await expect(page.getByRole("link", { name: /What is Machine Learning\?/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /History of Machine Learning/i })).toBeVisible();
  });
});

test.describe("Chapter - No Lessons", () => {
  test("chapter with no lessons redirects to generate page", async ({ page }) => {
    await page.goto("/b/ai/c/python-programming/ch/e2e-no-lessons-chapter");

    // Should redirect to generate page (shows login required for unauthenticated users)
    await expect(page).toHaveURL(/\/generate\/ch\/\d+/);
  });
});
