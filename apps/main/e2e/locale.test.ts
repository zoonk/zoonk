import { setLocale } from "@zoonk/e2e/fixtures/locale";
import { expect, test } from "./fixtures";

test.describe("Locale Behavior - English", () => {
  test("home page shows English start content", async ({ page }) => {
    await page.goto("/");

    const nav = page.getByRole("navigation");

    await expect(nav.getByRole("link", { exact: true, name: "Courses" })).not.toBeVisible();
    await expect(nav.getByRole("link", { exact: true, name: "New course" })).toBeVisible();

    await expect(page).toHaveURL(/\/$/u);
    await expect(page.getByRole("heading", { name: "What's your goal?" })).toBeVisible();
  });
});

test.describe("Locale Behavior - Portuguese", () => {
  test("Portuguese home shows Portuguese start content", async ({ page }) => {
    await setLocale(page, "pt");
    await page.goto("/");

    const nav = page.getByRole("navigation");

    await expect(nav.getByRole("link", { exact: true, name: "Cursos" })).not.toBeVisible();
    await expect(nav.getByRole("link", { exact: true, name: "Novo curso" })).toBeVisible();

    await expect(page).toHaveURL(/\/$/u);
    await expect(page.getByRole("heading", { name: /qual é o seu objetivo/iu })).toBeVisible();
  });
});

test.describe("Locale Navigation", () => {
  test("clicking start navbar link keeps user in Portuguese", async ({ page }) => {
    await setLocale(page, "pt");
    await page.goto("/courses");

    await expect(page.getByRole("heading", { name: /explorar cursos/iu })).toBeVisible();

    await page
      .getByRole("navigation")
      .getByRole("link", { exact: true, name: "Novo curso" })
      .click();

    await expect(page).toHaveURL(/\/start$/u);
    await expect(page.getByRole("heading", { name: /qual é o seu objetivo/iu })).toBeVisible();
  });
});
