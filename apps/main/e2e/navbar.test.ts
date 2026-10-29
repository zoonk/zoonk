import { ensureGuest } from "@zoonk/e2e/fixtures/guests";
import { mockCentralAuthTransport } from "./auth-transport";
import { expect, test } from "./fixtures";

test("a guest can create an account after leaving and returning to the app", async ({ page }) => {
  await ensureGuest(page);
  await mockCentralAuthTransport(page);
  await page.goto("/today");

  const trigger = page.getByRole("button", { name: /Guest.*User menu/iu });
  await trigger.click();
  await expect(page.getByRole("menuitem", { name: "Create an account" })).toBeVisible();
  await expect(page.getByRole("menuitem", { exact: true, name: "Log in" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Log out" })).toHaveCount(0);

  await page.getByRole("menuitem", { exact: true, name: "Pricing" }).click();
  await expect(page).toHaveURL(/\/pricing$/u);

  await expect(
    page.getByRole("heading", { level: 1, name: "Start free. Plus when you want everything." }),
  ).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/today$/u);
  await trigger.click();
  await page.getByRole("menuitem", { name: "Create an account" }).click();
  await expect(page.getByLabel("Email")).toBeVisible();
});
