import { expectHydrated } from "@zoonk/e2e/hydration";
import { expect, test } from "./fixtures";

test("Settings goes back to Today after opening from Certificates", async ({
  userWithoutProgress: page,
}) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto("/certificates");
  await expect(page.getByRole("heading", { name: "Certificates" })).toBeVisible();

  const accountMenu = page.getByRole("button", { name: /User menu/u });
  await expectHydrated(accountMenu);
  await accountMenu.click();
  await page.getByRole("menuitem", { exact: true, name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings$/u);

  const back = page.getByRole("link", { exact: true, name: "Back to Today" });
  await expect(back).toBeVisible();

  await page.setViewportSize({ height: 844, width: 390 });
  await expect(back).toBeVisible();
  await back.click();
  await expect(page).toHaveURL(/\/today$/u);
});

test("Help waits for a message before enabling Send", async ({ userWithoutProgress: page }) => {
  await page.goto("/support");

  const message = page.getByRole("textbox", { exact: true, name: "Message" });
  const send = page.getByRole("button", { name: "Send message" });

  await expectHydrated(message);
  await expect(send).toBeDisabled();
  await message.fill("   ");
  await expect(send).toBeDisabled();
  await message.fill("I need help with my plan.");
  await expect(send).toBeEnabled();
  await message.clear();
  await expect(send).toBeDisabled();
});
