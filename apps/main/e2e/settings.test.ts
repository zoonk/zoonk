import { instant } from "@next/playwright";
import { prisma } from "@zoonk/db";
import { expectHydrated } from "@zoonk/e2e/hydration";
import { expect, test } from "./fixtures";

test("a section's first page has no way back: the sidebar and the tab bar lead out", async ({
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

  const back = page.getByRole("link", { name: /^Back to /u });
  await expect(back).toBeHidden();

  await page.setViewportSize({ height: 844, width: 390 });
  await expect(back).toBeHidden();

  await page
    .getByRole("navigation", { name: "Learning tabs" })
    .getByRole("link", { name: "Today" })
    .click();

  await expect(page).toHaveURL(/\/today$/u);
});

test("on a phone settings pages go back to the settings list", async ({
  userWithoutProgress: page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/settings");

  const reminders = page.getByRole("link", { name: /^Reminders/u });
  await expectHydrated(reminders);
  await reminders.click();
  await expect(page).toHaveURL(/\/settings\/reminders$/u);

  const settingsEntry = await page.evaluate(() => globalThis.navigation.entries().at(-2)?.key);
  await page.getByRole("link", { exact: true, name: "Back to Settings" }).click();
  await expect(page).toHaveURL(/\/settings$/u);

  await expect
    .poll(() => page.evaluate(() => globalThis.navigation.currentEntry?.key))
    .toBe(settingsEntry);
});

test("on a tablet a Settings tab has no way back: the section's tabs lead between its pages", async ({
  userWithoutProgress: page,
}) => {
  await page.setViewportSize({ height: 1180, width: 820 });
  await page.goto("/settings");

  const tabs = page.getByRole("navigation", { name: "Settings" });
  const reminders = tabs.getByRole("link", { exact: true, name: "Reminders" });
  await expectHydrated(reminders);
  await reminders.click();
  await expect(page).toHaveURL(/\/settings\/reminders$/u);
  await expect(page.getByRole("link", { name: /^Back to /u })).toBeHidden();

  await tabs.getByRole("link", { exact: true, name: "Preferences" }).click();
  await expect(page).toHaveURL(/\/settings(?:\/appearance)?$/u);
});

test("on a phone statistics pages go back to the overview", async ({
  userWithoutProgress: page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/energy");
  await page.getByRole("link", { exact: true, name: "Back to Statistics" }).click();
  await expect(page).toHaveURL(/\/stats$/u);
});

test("Settings reserves the profile column while its contents load", async ({
  baseURL,
  userWithoutProgress: page,
}) => {
  await page.setViewportSize({ height: 900, width: 1440 });

  const width = await instant(
    page,
    async () => {
      await page.goto("/settings");
      const placeholders = page.locator('main [data-slot="page"] [data-slot="skeleton"]:visible');
      await expect(placeholders).not.toHaveCount(0);

      return placeholders.evaluateAll((nodes) =>
        Math.max(...nodes.map((node) => node.getBoundingClientRect().width)),
      );
    },
    { baseURL },
  );

  const profile = page.getByRole("textbox", { exact: true, name: "Name" });
  await expect(profile).toBeVisible();

  const formWidth = await profile.evaluate(
    (node) => node.closest("form")?.getBoundingClientRect().width,
  );

  expect(width).toBe(formWidth);
});

test("Subscription sets its plan placeholders side by side, as the plans are", async ({
  baseURL,
  userWithoutProgress: page,
}) => {
  await page.setViewportSize({ height: 900, width: 1440 });

  await instant(
    page,
    async () => {
      await page.goto("/subscription");

      const cards = page.locator(
        'main [data-slot="page"][aria-hidden="true"] > [aria-hidden="true"] > div > div',
      );

      await expect(cards).toHaveCount(2);

      const columns = await cards.evaluateAll((nodes) =>
        nodes.map((node) => node.getBoundingClientRect().left),
      );

      expect(new Set(columns).size).toBe(2);
    },
    { baseURL },
  );
});

test("Profile waits for a change before enabling Save, and again once it's saved", async ({
  userWithoutProgress: page,
}) => {
  await page.goto("/profile");

  const name = page.getByRole("textbox", { exact: true, name: "Name" });
  const save = page.getByRole("button", { exact: true, name: "Save" });
  await expectHydrated(name);
  await expect(save).toBeDisabled();

  await name.fill("Rita Lee");
  await expect(save).toBeEnabled();

  await name.press("Enter");
  await expect(page.getByText("Saved.")).toBeVisible();
  await expect(save).toBeDisabled();
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

test("the buddy editor is open beside Preferences' rows on a wide screen and a dialog from its row on a narrow one", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto("/settings/appearance");

  const editor = page.getByRole("region", { name: "Your buddy" });
  const noodle = editor.getByRole("radio", { name: /^Noodle/u });
  const save = editor.getByRole("button", { exact: true, name: "Save" });
  await expectHydrated(noodle);
  await expect(page.getByRole("button", { name: "Choose your buddy" })).toBeHidden();

  await noodle.click();
  const name = editor.getByRole("textbox", { name: "Name" });
  await name.fill("Mina");
  await name.press("Enter");
  await expect(save).toBeDisabled();
  await expect(noodle).toBeChecked();

  await expect
    .poll(() =>
      prisma.userLearningProfile.findUnique({
        select: { buddyKind: true, buddyName: true },
        where: { userId: noProgressUser.id },
      }),
    )
    .toEqual({ buddyKind: "noodle", buddyName: "Mina" });

  await page.setViewportSize({ height: 900, width: 1024 });
  await expect(editor).toBeHidden();
  await page.getByRole("button", { exact: true, name: "Change" }).click();
  await expect(page.getByRole("dialog", { name: "Your buddy" })).toBeVisible();
});
