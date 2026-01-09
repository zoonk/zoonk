import { expect, test } from "./fixtures";

test.describe("Locale Behavior - English", () => {
  test("home page shows English content", async ({ page }) => {
    await page.goto("/en/");

    // Navbar should be in English
    await expect(
      page.getByRole("link", { exact: true, name: "Courses" }),
    ).toBeVisible();

    await expect(
      page.getByRole("link", { exact: true, name: "Learn" }),
    ).toBeVisible();

    // Hero heading should be in English
    await expect(
      page.getByRole("heading", { name: /learn anything with ai/i }),
    ).toBeVisible();
  });
});

test.describe("Locale Behavior - Portuguese", () => {
  test("Portuguese home shows Portuguese content", async ({ page }) => {
    await page.goto("/pt");

    // Wait for Portuguese hero heading to confirm locale is loaded
    await expect(
      page.getByRole("heading", { name: /aprenda qualquer coisa com ia/i }),
    ).toBeVisible();

    // Navbar should be in Portuguese (use exact match to avoid hero links)
    await expect(
      page.getByRole("link", { exact: true, name: "Cursos" }),
    ).toBeVisible();

    await expect(
      page.getByRole("link", { exact: true, name: "Aprender" }),
    ).toBeVisible();
  });
});

test.describe("Locale Navigation", () => {
  test("clicking navbar links from /pt keeps user in Portuguese", async ({
    page,
  }) => {
    await page.goto("/pt");

    // Click Courses link (in Portuguese: "Cursos")
    await page.getByRole("link", { exact: true, name: "Cursos" }).click();

    // Should be on Portuguese courses page
    await expect(page).toHaveURL(/\/pt\/courses/);

    await expect(
      page.getByRole("heading", { name: /explorar cursos/i }),
    ).toBeVisible();
  });
});
