import { expect, test } from "./fixtures";

test.describe("Course Chapters List", () => {
  test("displays chapters with position numbers as links", async ({ page }) => {
    await page.goto("/b/ai/c/machine-learning");

    // Verify chapters are displayed with position numbers
    await expect(page.getByText("01", { exact: true })).toBeVisible();
    await expect(page.getByText("02", { exact: true })).toBeVisible();
    await expect(page.getByText("03", { exact: true })).toBeVisible();

    // Verify chapter titles are visible as links (not buttons anymore)
    await expect(
      page.getByRole("link", { name: /Introduction to Machine Learning/i }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Data Preparation/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Regression Algorithms/i })).toBeVisible();
  });

  test("chapter link navigates to chapter page", async ({ page }) => {
    await page.goto("/b/ai/c/machine-learning");

    const chapterLink = page.getByRole("link", {
      name: /Introduction to Machine Learning/i,
    });
    await expect(chapterLink).toBeVisible();

    await chapterLink.click();

    // Verify URL is correct - now uses /ch/ instead of /c/
    await expect(page).toHaveURL(
      /\/b\/ai\/c\/machine-learning\/ch\/introduction-to-machine-learning/,
    );

    // Verify we're on the chapter page with its heading
    await expect(
      page.getByRole("heading", { level: 1, name: /Introduction to Machine Learning/i }),
    ).toBeVisible();
  });

  test("excludes unpublished chapters from the list", async ({ page }) => {
    await page.goto("/b/ai/c/machine-learning");

    // Published chapters should be visible
    await expect(
      page.getByRole("link", { name: /Introduction to Machine Learning/i }),
    ).toBeVisible();

    // Unpublished chapter "Tree-Based Models" should NOT be visible
    await expect(page.getByRole("link", { name: /Tree-Based Models/i })).not.toBeVisible();

    // Position number 04 (for Tree-Based Models) should not exist
    await expect(page.getByText("04", { exact: true })).not.toBeVisible();
  });
});

test.describe("Course Chapters - Locale", () => {
  test("shows chapters in Portuguese for Portuguese locale", async ({ page }) => {
    await page.goto("/pt/b/ai/c/machine-learning");

    // Portuguese chapter titles should be visible as links
    await expect(page.getByRole("link", { name: /Introdução ao Machine Learning/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Preparação de Dados/i })).toBeVisible();
  });
});

test.describe("Course Chapter Search", () => {
  test("filters chapters by title", async ({ page }) => {
    await page.goto("/b/ai/c/machine-learning");

    // Fill search input
    await page.getByLabel(/search chapters/i).fill("regression");

    // Only matching chapter should be visible
    await expect(page.getByRole("link", { name: /Regression Algorithms/i })).toBeVisible();

    // Non-matching chapters should be hidden
    await expect(
      page.getByRole("link", { name: /Introduction to Machine Learning/i }),
    ).not.toBeVisible();
    await expect(page.getByRole("link", { name: /Data Preparation/i })).not.toBeVisible();
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
    await expect(page.getByRole("link", { name: /Regression Algorithms/i })).toBeVisible();
  });

  test("shows empty state when no matches found", async ({ page }) => {
    await page.goto("/b/ai/c/machine-learning");

    await page.getByLabel(/search chapters/i).fill("nonexistent xyz");

    await expect(page.getByText(/no chapters found/i)).toBeVisible();
  });

  test("clears search and shows all chapters again", async ({ page }) => {
    await page.goto("/b/ai/c/machine-learning");

    // Search to filter
    const searchInput = page.getByLabel(/search chapters/i);
    await searchInput.fill("regression");

    // Verify filtered
    await expect(
      page.getByRole("link", { name: /Introduction to Machine Learning/i }),
    ).not.toBeVisible();

    // Clear search
    await searchInput.clear();

    // All chapters should be visible again
    await expect(
      page.getByRole("link", { name: /Introduction to Machine Learning/i }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Data Preparation/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Regression Algorithms/i })).toBeVisible();
  });

  test("matches Portuguese chapters without accents (accent-insensitive search)", async ({
    page,
  }) => {
    await page.goto("/pt/b/ai/c/machine-learning");

    // Search for "introducao" (without accent) should match "Introdução ao Machine Learning"
    await page.getByLabel(/buscar capítulos/i).fill("introducao");

    // Chapter with accent "Introdução" should be visible
    await expect(page.getByRole("link", { name: /Introdução ao Machine Learning/i })).toBeVisible();

    // Non-matching chapters should be hidden
    await expect(page.getByRole("link", { name: /Preparação de Dados/i })).not.toBeVisible();
  });
});
