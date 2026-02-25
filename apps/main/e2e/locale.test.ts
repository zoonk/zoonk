import { LOCALE_COOKIE } from "@zoonk/utils/locale";
import { type Page, expect, test } from "./fixtures";

async function setPortugueseLocale(page: Page) {
  await page
    .context()
    .addCookies([{ domain: "localhost", name: LOCALE_COOKIE, path: "/", value: "pt" }]);
}

test.describe("Locale Behavior - English", () => {
  test("home page shows English content", async ({ page }) => {
    await page.goto("/");

    const nav = page.getByRole("navigation");

    // Navbar should be in English (scoped to navigation to avoid hero links)
    await expect(nav.getByRole("link", { exact: true, name: "Courses" })).toBeVisible();

    await expect(nav.getByRole("link", { exact: true, name: "Learn" })).toBeVisible();

    // Hero heading should be in English
    await expect(page.getByRole("heading", { name: /learn anything with ai/i })).toBeVisible();
  });
});

test.describe("Locale Behavior - Portuguese", () => {
  test("Portuguese home shows Portuguese content", async ({ page }) => {
    await setPortugueseLocale(page);
    await page.goto("/");

    const nav = page.getByRole("navigation");

    // Wait for Portuguese hero heading to confirm locale is loaded
    await expect(
      page.getByRole("heading", { name: /aprenda qualquer coisa com ia/i }),
    ).toBeVisible();

    // Navbar should be in Portuguese (scoped to navigation to avoid hero links)
    await expect(nav.getByRole("link", { exact: true, name: "Cursos" })).toBeVisible();

    await expect(nav.getByRole("link", { exact: true, name: "Aprender" })).toBeVisible();
  });
});

test.describe("Locale Navigation", () => {
  test("clicking navbar links keeps user in Portuguese", async ({ page }) => {
    await setPortugueseLocale(page);
    await page.goto("/");

    // Click Courses link in navbar (scoped to navigation to avoid hero links)
    await page.getByRole("navigation").getByRole("link", { exact: true, name: "Cursos" }).click();

    await expect(page).toHaveURL(/\/courses/);

    await expect(page.getByRole("heading", { name: /explorar cursos/i })).toBeVisible();
  });
});
