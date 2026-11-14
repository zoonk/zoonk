import { type Locator } from "@playwright/test";
import { expectHydrated } from "@zoonk/e2e/hydration";
import { type Page, expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";

const PHONE = { height: 844, width: 390 };

async function openFromMenu(page: Page, { item, menu }: { item: string; menu: string }) {
  const trigger = page.getByRole("button", { exact: true, name: menu });
  await expectHydrated(trigger);
  await trigger.focus();
  await page.keyboard.press("Enter");

  const menuItem = page.getByRole("menuitem", { name: item });
  await menuItem.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menu")).toBeHidden();

  return trigger;
}

function focusIsIn(overlay: Locator) {
  return overlay.evaluate((element) => element.contains(document.activeElement));
}

/** By keyboard: the overlay keeps focus once its menu has gone, and Esc gives it to the menu's trigger. */
async function expectHandoff(
  page: Page,
  { overlay, trigger }: { overlay: Locator; trigger: Locator },
) {
  await expect(overlay).toBeVisible();
  await expect.poll(() => focusIsIn(overlay)).toBe(true);

  await page.keyboard.press("Tab");
  expect(await focusIsIn(overlay)).toBe(true);

  await page.keyboard.press("Escape");
  await expect(overlay).toBeHidden();
  await expect(trigger).toBeFocused();
}

test.describe("An overlay opened from a menu item", () => {
  test("the phone's account menu: Send feedback", async ({ browser }) => {
    await asPersona(browser, { persona: "buddy" }, async ({ page }) => {
      await page.setViewportSize(PHONE);
      await page.goto("/today");

      const trigger = await openFromMenu(page, { item: "Send feedback", menu: "User menu" });

      await expectHandoff(page, {
        overlay: page.getByRole("dialog", { name: "Send feedback" }),
        trigger,
      });
    });
  });

  for (const [screen, size] of [
    ["phone", PHONE],
    ["computer", { height: 900, width: 1440 }],
  ] as const) {
    test(`a page's …: Report a problem, on a ${screen}`, async ({ browser }) => {
      await asPersona(browser, { persona: "exam" }, async ({ page }) => {
        await page.setViewportSize(size);
        await page.goto("/exam");

        const trigger = await openFromMenu(page, {
          item: "Report a problem",
          menu: "Exam options",
        });

        await expectHandoff(page, {
          overlay: page.getByRole("dialog", { name: "Report a problem" }),
          trigger,
        });
      });
    });
  }

  test("the Plan's menu: archive's confirm", async ({ browser }) => {
    await asPersona(browser, { persona: "buddy" }, async ({ page }) => {
      await page.goto("/plan");

      const trigger = await openFromMenu(page, { item: "Archive this goal", menu: "Plan options" });
      await expectHandoff(page, { overlay: page.getByRole("alertdialog"), trigger });
    });
  });
});
