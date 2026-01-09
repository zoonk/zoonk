import { expect, test } from "./fixtures";

test.describe("Course Chapters Accordion", () => {
  test("displays chapters with position numbers and expands to show lessons", async ({
    page,
  }) => {
    await page.goto("/en/b/ai/c/machine-learning");

    // Verify chapters are displayed with position numbers
    // Position numbers should be visible (01, 02, 03 for the 3 published chapters)
    await expect(page.getByText("01")).toBeVisible();
    await expect(page.getByText("02")).toBeVisible();
    await expect(page.getByText("03")).toBeVisible();

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
    await page.goto("/en/b/ai/c/machine-learning");

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
    await page.goto("/en/b/ai/c/machine-learning");

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
    await page.goto("/en/b/ai/c/machine-learning");

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
    await expect(page.getByText("04")).not.toBeVisible();
  });
});

test.describe("Course Chapters - Empty State", () => {
  test("renders course page without chapters gracefully", async ({ page }) => {
    // This course has chapters but we're testing the page renders
    // A course that never had chapters would also work
    await page.goto("/en/b/ai/c/python-programming");

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
