import { expect, test } from "@zoonk/e2e/fixtures";

test.describe("Locale Behavior - English", () => {
  test("home page shows English content", async ({ page }) => {
    await page.goto("/");

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

  test("courses page shows English content", async ({ page }) => {
    await page.goto("/courses");

    await expect(
      page.getByRole("heading", { name: /explore courses/i }),
    ).toBeVisible();
    await expect(
      page.getByText(/start learning something new today/i),
    ).toBeVisible();
  });

  test("learn page shows English content", async ({ page }) => {
    await page.goto("/learn");

    await expect(
      page.getByRole("heading", { name: /what do you want to learn/i }),
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

  test("Portuguese courses page shows Portuguese content", async ({ page }) => {
    await page.goto("/pt/courses");

    await expect(
      page.getByRole("heading", { name: /explorar cursos/i }),
    ).toBeVisible();
  });

  test("Portuguese learn page shows Portuguese content", async ({ page }) => {
    await page.goto("/pt/learn");

    await expect(
      page.getByRole("heading", { name: /o que você quer aprender/i }),
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

  test("clicking Learn from /pt keeps user in Portuguese", async ({ page }) => {
    await page.goto("/pt");

    // Click Learn link (in Portuguese: "Aprender")
    await page.getByRole("link", { exact: true, name: "Aprender" }).click();

    // Should be on Portuguese learn page
    await expect(page).toHaveURL(/\/pt\/learn/);
    await expect(
      page.getByRole("heading", { name: /o que você quer aprender/i }),
    ).toBeVisible();
  });

  test("page headings match selected locale", async ({ page }) => {
    // English
    await page.goto("/courses");
    await expect(
      page.getByRole("heading", { name: /explore courses/i }),
    ).toBeVisible();

    // Portuguese
    await page.goto("/pt/courses");
    await expect(
      page.getByRole("heading", { name: /explorar cursos/i }),
    ).toBeVisible();
  });

  test("button text matches selected locale", async ({ page }) => {
    // English home CTAs
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: "Learn anything" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Explore courses" }),
    ).toBeVisible();

    // Portuguese home CTAs
    await page.goto("/pt");
    await expect(
      page.getByRole("link", { name: /aprenda qualquer coisa/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /explorar cursos/i }),
    ).toBeVisible();
  });
});
