import { prisma } from "@zoonk/db";
import { expectAccessibleRoutes } from "@zoonk/e2e/fixtures/accessibility";
import { addGradedEssay, addTodayMock } from "./exam-fixtures";
import { test } from "./fixtures";
import { createCheckpointLearner } from "./fun-rewards-fixtures";
import { MODES, asPersona, findPlanChapterId } from "./learn-personas";
import { openAs } from "./study-day";

/**
 * Accessibility of the learning screens, each as the persona it's for, in Focus and in Fun, at
 * phone and desktop widths, light and dark (Fun is dark only, so it's scanned on a light device and
 * checked to stay dark): no serious or critical axe violation anywhere.
 */

const SCAN_TIMEOUT_MS = 600_000;

test.describe.configure({ timeout: SCAN_TIMEOUT_MS });

for (const mode of MODES) {
  test.describe(`Learning screens are accessible in ${mode}`, () => {
    test("Today, the session, the tabs and the stats of a huge goal", async ({ browser }) => {
      await asPersona(browser, { mode, persona: "hugeGoal" }, async ({ page, user }) => {
        // The chapter Maya is in, and the one before it with questions to test out of.
        const [chapterId, testOutChapterId] = await Promise.all([
          findPlanChapterId(user.goalId, "Exponents and scientific notation"),
          findPlanChapterId(user.goalId, "Fractions and percentages"),
        ]);

        await expectAccessibleRoutes(page, [
          { path: "/today" },
          { path: "/session" },
          { path: "/plan" },
          { path: `/plan/test-out/${testOutChapterId}` },
          { path: "/progress" },
          { path: "/content" },
          { path: "/content/map" },
          { path: `/content/chapters/${chapterId}` },
          { path: "/mistakes" },
          { path: "/mistakes/practice" },
          { path: "/activity" },
          { path: "/energy" },
          { path: "/level" },
          { path: "/patterns" },
          { path: "/score" },
          { path: "/my" },
          { path: "/buddy" },
          { path: "/logbook" },
        ]);
      });
    });

    test("an exam goal with a mock and an essay", async ({ browser }) => {
      await asPersona(browser, { mode, persona: "exam" }, async ({ page, user }) => {
        // Today builds the day's session the mock and the essay join.
        await page.goto("/today");

        // One after the other: each takes the session's next block position.
        const mock = await addTodayMock({ goalId: user.goalId, userId: user.id });
        const essay = await addGradedEssay({ goalId: user.goalId, userId: user.id });

        await expectAccessibleRoutes(page, [
          { path: "/today" },
          { path: "/plan" },
          { path: "/progress" },
          { path: "/exam" },
          { path: `/mock/${mock.blockId}` },
          { path: `/essay/${essay.blockId}` },
        ]);
      });
    });

    test("a language goal with its units, a pattern and a call", async ({ browser }) => {
      await asPersona(browser, { mode, persona: "language" }, async ({ page, user }) => {
        const [unit, pattern] = await Promise.all([
          prisma.chapter.findFirstOrThrow({
            where: { targetLanguage: "en", title: "Alugando um apartamento" },
          }),
          prisma.mistakePattern.findFirstOrThrow({ where: { userId: user.id } }),
        ]);

        const call = await prisma.languageConversation.findFirstOrThrow({
          where: { userId: user.id },
        });

        await expectAccessibleRoutes(page, [
          { path: "/today" },
          { path: "/plan" },
          { path: "/progress" },
          { path: "/content" },
          { path: `/content/units/${unit.id}` },
          { path: `/pattern/${pattern.id}` },
          { path: `/conversation/${call.id}` },
        ]);
      });
    });

    test("a phase checkpoint and the weekly challenge", async ({ browser }) => {
      const [boss, weekly] = await Promise.all([
        createCheckpointLearner({ kind: "boss", mode }),
        createCheckpointLearner({ kind: "weekly", mode }),
      ]);

      const bossPage = await openAs(browser, boss.user);
      await expectAccessibleRoutes(bossPage, [{ path: `/checkpoint/${boss.block.id}` }]);
      await bossPage.context().close();

      const weeklyPage = await openAs(browser, weekly.user);
      await expectAccessibleRoutes(weeklyPage, [{ path: `/checkpoint/${weekly.block.id}` }]);
      await weeklyPage.context().close();
    });

    test("an explain goal", async ({ browser }) => {
      await asPersona(browser, { mode, persona: "explain" }, async ({ page, user }) => {
        await expectAccessibleRoutes(page, [
          { path: `/explain/${user.goalId}` },
          { path: "/today" },
        ]);
      });
    });

    test("the Fun persona's buddy, logbook and progress", async ({ browser }) => {
      await asPersona(browser, { mode, persona: "fun" }, async ({ page }) => {
        await expectAccessibleRoutes(page, [
          { path: "/today" },
          { path: "/buddy" },
          { path: "/logbook" },
          { path: "/progress" },
          { path: "/content" },
        ]);
      });
    });
  });
}
