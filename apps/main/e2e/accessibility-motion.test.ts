import { findMovingAnimations } from "@zoonk/e2e/fixtures/accessibility";
import { expect, test } from "./fixtures";
import { createModeLearner } from "./fun-rewards-fixtures";
import { openAs } from "./study-day";

/**
 * Reduced motion on Fun's screens: when the device asks for it, the buddy's glow, the logbook's
 * pages and menus opening fade or stay still instead of moving. The lesson player's flip is checked
 * in the player's browser tests.
 */

test("Fun screens and menus stay still with reduced motion", async ({ browser }) => {
  const { user } = await createModeLearner("fun");
  const page = await openAs(browser, user);
  await page.emulateMedia({ reducedMotion: "reduce" });

  const moving: string[] = [];

  const readMotion = async (where: string) => {
    const found = await findMovingAnimations(page);
    moving.push(...found.map((animation) => `${where}: ${animation}`));
  };

  for (const path of ["/today", "/buddy", "/logbook", "/progress", "/content"]) {
    // oxlint-disable-next-line no-await-in-loop -- One page visits each screen in turn.
    await page.goto(path);
    // oxlint-disable-next-line no-await-in-loop -- The screen shows before its motion is read.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // oxlint-disable-next-line no-await-in-loop -- Each screen's motion is read on it.
    await readMotion(path);
  }

  await page.getByRole("button", { name: "User menu" }).click();
  await expect(page.getByRole("menu")).toBeVisible();
  await readMotion("user menu");

  expect(moving, moving.join("\n")).toEqual([]);
  await page.context().close();
});
