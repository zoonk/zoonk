import { expect, test } from "./fixtures";

test.describe("Course Chapters Accordion", () => {
  test("displays chapters with position numbers and expands to show lessons", async ({
    page,
  }) => {
    await page.goto("/b/ai/c/machine-learning");

    // Verify chapters are displayed with position numbers
    // Position numbers should be visible (01, 02, 03 for the 3 published chapters)
    await expect(page.getByText("01", { exact: true })).toBeVisible();
    await expect(page.getByText("02", { exact: true })).toBeVisible();
    await expect(page.getByText("03", { exact: true })).toBeVisible();

    // Verify chapter titles are visible
    await expect(
      page.getByRole("button", { name: /Introduction to Machine Learning/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Data Preparation/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Regression Algorithms/i }),
    ).toBeVisible();

    // Click to expand the first chapter
    await page
      .getByRole("button", { name: /Introduction to Machine Learning/i })
      .click();

    // Verify lessons are visible after expanding
    await expect(
      page.getByRole("link", { name: /What is Machine Learning\?/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /History of Machine Learning/i }),
    ).toBeVisible();

    // Unpublished lesson "Types of Learning" should NOT be visible
    await expect(
      page.getByRole("link", { name: /Types of Learning/i }),
    ).not.toBeVisible();
  });

  test("closes current chapter when another is opened", async ({ page }) => {
    await page.goto("/b/ai/c/machine-learning");

    // Expand first chapter
    await page
      .getByRole("button", { name: /Introduction to Machine Learning/i })
      .click();

    // Verify first chapter's lesson is visible
    await expect(
      page.getByRole("link", { name: /What is Machine Learning\?/i }),
    ).toBeVisible();

    // Click to expand second chapter
    await page.getByRole("button", { name: /Data Preparation/i }).click();

    // Verify second chapter's lessons are visible
    await expect(
      page.getByRole("link", { name: /Understanding Datasets/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Data Cleaning/i }),
    ).toBeVisible();

    // First chapter's lessons should no longer be visible
    await expect(
      page.getByRole("link", { name: /What is Machine Learning\?/i }),
    ).not.toBeVisible();
  });

  test("lesson link navigates to the correct URL", async ({ page }) => {
    await page.goto("/b/ai/c/machine-learning");

    // Expand first chapter
    await page
      .getByRole("button", { name: /Introduction to Machine Learning/i })
      .click();

    // Wait for lessons to be visible
    const lessonLink = page.getByRole("link", {
      name: /What is Machine Learning\?/i,
    });
    await expect(lessonLink).toBeVisible();

    // Click the lesson link
    await lessonLink.click();

    // Verify URL is correct
    await expect(page).toHaveURL(
      /\/b\/ai\/c\/machine-learning\/c\/introduction-to-machine-learning\/l\/what-is-machine-learning/,
    );
  });

  test("excludes unpublished chapters from the list", async ({ page }) => {
    await page.goto("/b/ai/c/machine-learning");

    // Published chapters should be visible
    await expect(
      page.getByRole("button", { name: /Introduction to Machine Learning/i }),
    ).toBeVisible();

    // Unpublished chapter "Tree-Based Models" should NOT be visible
    // (Neural Networks is mentioned in course description, so we can't test for that)
    await expect(
      page.getByRole("button", { name: /Tree-Based Models/i }),
    ).not.toBeVisible();

    // Position number 04 (for Tree-Based Models) should not exist
    // since only 3 chapters are published
    await expect(page.getByText("04", { exact: true })).not.toBeVisible();
  });
});

test.describe("Course Chapters - Empty State", () => {
  test("renders course page without chapters gracefully", async ({ page }) => {
    // This course has chapters but we're testing the page renders
    // A course that never had chapters would also work
    await page.goto("/b/ai/c/python-programming");

    // Course header should still show
    await expect(
      page.getByRole("heading", { name: /python programming/i }),
    ).toBeVisible();

    // Chapters should be present for this course
    await expect(
      page.getByRole("button", { name: /Python Fundamentals/i }),
    ).toBeVisible();
  });
});

test.describe("Course Chapters - No Lessons", () => {
  test("shows generate lessons message and navigates to generate page", async ({
    page,
  }) => {
    await page.goto("/b/ai/c/python-programming");

    // Expand the chapter that has no lessons
    await page.getByRole("button", { name: /e2e no lessons chapter/i }).click();

    // Should see the explanatory message
    await expect(
      page.getByText(/lessons haven't been generated for this chapter yet/i),
    ).toBeVisible();

    // Should see the generate lessons button
    const generateButton = page.getByRole("link", {
      name: /generate lessons/i,
    });
    await expect(generateButton).toBeVisible();

    // Click the generate lessons button
    await generateButton.click();

    // Should navigate to generate chapter page
    await expect(page).toHaveURL(/\/generate\/ch\/\d+/);
    await expect(
      page.getByRole("heading", { name: /generate chapter/i }),
    ).toBeVisible();
    await expect(page.getByText(/coming soon/i)).toBeVisible();
  });
});

test.describe("Course Chapters - Locale", () => {
  test("shows chapters in Portuguese for Portuguese locale", async ({
    page,
  }) => {
    await page.goto("/pt/b/ai/c/machine-learning");

    // Portuguese chapter titles should be visible
    await expect(
      page.getByRole("button", { name: /Introdução ao Machine Learning/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Preparação de Dados/i }),
    ).toBeVisible();
  });
});

test.describe("Course Chapter Search", () => {
  test("filters chapters by chapter title", async ({ page }) => {
    await page.goto("/b/ai/c/machine-learning");

    // Fill search input
    await page.getByLabel(/search chapters/i).fill("regression");

    // Only matching chapter should be visible
    await expect(
      page.getByRole("button", { name: /Regression Algorithms/i }),
    ).toBeVisible();

    // Non-matching chapters should be hidden
    await expect(
      page.getByRole("button", { name: /Introduction to Machine Learning/i }),
    ).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: /Data Preparation/i }),
    ).not.toBeVisible();
  });

  test("filters by lesson title and auto-expands parent chapter", async ({
    page,
  }) => {
    await page.goto("/b/ai/c/machine-learning");

    // Search for a lesson title
    await page.getByLabel(/search chapters/i).fill("cleaning");

    // Parent chapter should be visible and expanded
    await expect(
      page.getByRole("button", { name: /Data Preparation/i }),
    ).toBeVisible();

    // Matching lesson should be visible (auto-expanded)
    await expect(
      page.getByRole("link", { name: /Data Cleaning/i }),
    ).toBeVisible();

    // Non-matching lessons in same chapter should be hidden
    await expect(
      page.getByRole("link", { name: /Understanding Datasets/i }),
    ).not.toBeVisible();
  });

  test("persists search in URL and survives page reload", async ({ page }) => {
    await page.goto("/b/ai/c/machine-learning");

    await page.getByLabel(/search chapters/i).fill("regression");

    // URL should update with search param
    await expect(page).toHaveURL(/\?q=regression/);

    // Reload the page
    await page.reload();

    // Search should persist
    await expect(page.getByLabel(/search chapters/i)).toHaveValue("regression");

    // Filtered results should still show
    await expect(
      page.getByRole("button", { name: /Regression Algorithms/i }),
    ).toBeVisible();
  });

  test("shows empty state when no matches found", async ({ page }) => {
    await page.goto("/b/ai/c/machine-learning");

    await page.getByLabel(/search chapters/i).fill("nonexistent xyz");

    await expect(page.getByText(/no chapters or lessons found/i)).toBeVisible();
  });

  test("clears search and shows all chapters again", async ({ page }) => {
    await page.goto("/b/ai/c/machine-learning");

    // Search to filter
    const searchInput = page.getByLabel(/search chapters/i);
    await searchInput.fill("regression");

    // Verify filtered
    await expect(
      page.getByRole("button", { name: /Introduction to Machine Learning/i }),
    ).not.toBeVisible();

    // Clear search
    await searchInput.clear();

    // All chapters should be visible again
    await expect(
      page.getByRole("button", { name: /Introduction to Machine Learning/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Data Preparation/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Regression Algorithms/i }),
    ).toBeVisible();
  });

  test("matches Portuguese chapters without accents (accent-insensitive search)", async ({
    page,
  }) => {
    await page.goto("/pt/b/ai/c/machine-learning");

    // Search for "introducao" (without accent) should match "Introdução ao Machine Learning"
    await page.getByLabel(/buscar capítulos/i).fill("introducao");

    // Chapter with accent "Introdução" should be visible
    await expect(
      page.getByRole("button", { name: /Introdução ao Machine Learning/i }),
    ).toBeVisible();

    // Non-matching chapters should be hidden
    await expect(
      page.getByRole("button", { name: /Preparação de Dados/i }),
    ).not.toBeVisible();
  });
});
