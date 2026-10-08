import { findMovingAnimations } from "@zoonk/e2e/fixtures/accessibility";
import { expect, test } from "./fixtures";
import { createStudyDay, openAs } from "./study-day";

/**
 * Reduced motion on the learner's screens: when the device asks for it, screens and menus opening
 * fade or stay still instead of moving. The lesson player's motion is checked in the player's
 * browser tests.
 */

test("screens and menus stay still with reduced motion", async ({ browser }) => {
  // A goal with a plan, so the Journey shows its path.
  const { user } = await createStudyDay();
  const page = await openAs(browser, user);
  await page.emulateMedia({ reducedMotion: "reduce" });

  const moving: string[] = [];

  const readMotion = async (where: string) => {
    const found = await findMovingAnimations(page);
    moving.push(...found.map((animation) => `${where}: ${animation}`));
  };

  for (const path of ["/today", "/buddy", "/logbook", "/journey", "/stats"]) {
    // oxlint-disable-next-line no-await-in-loop -- One page visits each screen in turn.
    await page.goto(path);
    // oxlint-disable-next-line no-await-in-loop -- The screen shows before its motion is read.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // oxlint-disable-next-line no-await-in-loop -- Each screen's motion is read on it.
    await readMotion(path);
  }

  // The account menu lives on the tabs' bar; sections such as Statistics have their own bar.
  await page.goto("/today");
  await page.getByRole("button", { name: "User menu" }).click();
  await expect(page.getByRole("menu")).toBeVisible();
  await readMotion("user menu");

  expect(moving, moving.join("\n")).toEqual([]);
  await page.context().close();
});
