import { findMovingAnimations } from "@zoonk/e2e/fixtures/accessibility";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { type Page, expect, test } from "./fixtures";
import { asPersona, showInMode } from "./learn-personas";

/**
 * Reduced motion: when the device asks for it, Fun's animations (the buddy's glow, the paper's flip,
 * the logbook's pages, menus opening) fade or stay still instead of moving. Without it, the flip
 * moves, so the check can tell the difference.
 */

async function answerCheck(page: Page) {
  const right = page.getByRole("radio", { name: "Where the electron is most likely to be found" });
  await right.click();
  await page.getByRole("button", { name: /^Check/u }).click();
  await expect(page.getByRole("status").filter({ hasText: "Correct!" })).toBeVisible();
}

async function openFunCheck(page: Page, userId: string) {
  const [{ lesson }] = await Promise.all([
    playableLessonFixture({ steps: ["check", "summary"] }),
    showInMode(page.context(), { mode: "fun", userId }),
  ]);

  await page.goto(`/learn/${lesson.id}`);
}

test.describe("Reduced motion", () => {
  test("Fun screens and menus stay still", async ({ browser }) => {
    await asPersona(browser, { mode: "fun", persona: "fun" }, async ({ page }) => {
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
    });
  });

  test("the paper fades instead of flipping", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openFunCheck(page, noProgressUser.id);
    await answerCheck(page);
    await expect.poll(() => findMovingAnimations(page)).toEqual([]);
  });

  test("without reduced motion, the paper flips", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await openFunCheck(page, noProgressUser.id);
    await answerCheck(page);

    await expect
      .poll(() => findMovingAnimations(page))
      .toContainEqual(expect.stringContaining("fun-flip"));
  });
});
