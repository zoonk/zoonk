import { setLocale } from "@zoonk/e2e/fixtures/locale";
import { expect, test } from "./fixtures";

test.describe("Locale Behavior - English", () => {
  test("home page shows English learn content", async ({ page }) => {
    await page.goto("/");

    const nav = page.getByRole("navigation");

    await expect(nav.getByRole("link", { exact: true, name: "Courses" })).not.toBeVisible();
    await expect(nav.getByRole("link", { exact: true, name: "Learn" })).toBeVisible();

    await expect(page).toHaveURL(/\/$/u);
    await expect(page.getByRole("heading", { name: /learn anything/iu })).toBeVisible();
  });
});

test.describe("Locale Behavior - Portuguese", () => {
  test("Portuguese home shows Portuguese learn content", async ({ page }) => {
    await setLocale(page, "pt");
    await page.goto("/");

    const nav = page.getByRole("navigation");

    await expect(nav.getByRole("link", { exact: true, name: "Cursos" })).not.toBeVisible();
    await expect(nav.getByRole("link", { exact: true, name: "Aprender" })).toBeVisible();

    await expect(page).toHaveURL(/\/$/u);
    await expect(page.getByRole("heading", { name: /aprenda qualquer coisa/iu })).toBeVisible();
  });
});

test.describe("Locale Navigation", () => {
  test("clicking learn navbar link keeps user in Portuguese", async ({ page }) => {
    await setLocale(page, "pt");
    await page.goto("/courses");

    await expect(page.getByRole("heading", { name: /explorar cursos/iu })).toBeVisible();

    await page.getByRole("navigation").getByRole("link", { exact: true, name: "Aprender" }).click();

    await expect(page).toHaveURL(/\/learn$/u);
    await expect(page.getByRole("heading", { name: /aprenda qualquer coisa/iu })).toBeVisible();
  });
});
