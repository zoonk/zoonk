import { instant } from "@next/playwright";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import {
  goalFixture,
  planChangeFixture,
  planFixture,
  planItemFixture,
} from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { MS_PER_DAY, toUTCMidnight } from "@zoonk/utils/date";
import { openLearnerPalette } from "./command-palette";
import { expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";
import { createStudyDay, openAs } from "./study-day";

/** Goal A fell behind (an exam's plan); B has different work and its own document request. */
async function switchingDay() {
  const day = await createStudyDay();
  const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: day.goal.id } });

  await planChangeFixture({
    kind: "missedDays",
    payload: {
      behind: {
        canFocus: false,
        coveredAfter: 0.4,
        coveredBefore: 0.8,
        currentMinutes: day.goal.dailyMinutes,
        measure: "exam",
      },
      days: 3,
      source: "system",
    },
    planId: plan.id,
    status: "applied",
  });

  const otherGoal = await goalFixture({
    dailyMinutes: 35,
    researchUploadReason: "classMaterial",
    timezone: "UTC",
    title: "Different study goal",
    userId: day.user.id,
  });

  const otherPlan = await planFixture({ goalId: otherGoal.id });
  await planItemFixture({ lessonId: day.lesson.id, planId: otherPlan.id });
  const otherDay = await studySessionFixture({ goalId: otherGoal.id, userId: day.user.id });

  await studySessionBlockFixture({
    estimatedMinutes: 5,
    lessonId: day.lesson.id,
    payload: { title: "Goal B lesson" },
    sessionId: otherDay.id,
  });

  return { ...day, otherGoal };
}

test.describe("Today review regressions", () => {
  test("a pending goal switch blocks focus, pointer actions and the global Enter shortcut, then replaces the retained recommendation with the new goal's notice", async ({
    browser,
  }, testInfo) => {
    const { goal, otherGoal, session, user } = await switchingDay();
    const page = await browser.newPage({ storageState: user.storageState, timezoneId: "UTC" });
    await page.setViewportSize({ height: 900, width: 1280 });
    await page.goto("/today");
    const notice = page.getByRole("region", { name: "Plan change" });
    await expect(notice.getByRole("link", { name: "More time a day" })).toBeVisible();
    const start = page.getByRole("button", { name: "Start session" });
    await start.focus();

    const release = Promise.withResolvers<null>();
    const held = Promise.withResolvers<null>();
    const actions: { body: string | null; id: string }[] = [];
    const switchBody = JSON.stringify([otherGoal.id]);

    const followBodies = new Set(
      [goal.id, otherGoal.id].map((goalId) => JSON.stringify([{ goalId, timeZone: "UTC" }])),
    );

    await page.route("**/*", async (route) => {
      const request = route.request();

      const actionId = request.headers()["next-action"];

      if (request.method() === "POST" && actionId) {
        actions.push({ body: request.postData(), id: actionId });

        if (request.postData() === switchBody) {
          held.resolve(null);
          await release.promise;
        }
      }

      await route.fallback();
    });

    try {
      // Continue lands above the highlighted row, so the learner's goals wait with it.
      const palette = await openLearnerPalette(page);
      await palette.getByRole("option", { name: `Switch to ${otherGoal.title}` }).click();
      await held.promise;
      await expect(page.getByRole("main")).toHaveAttribute("inert", "");
      await expect(start).toBeDisabled();
      await page.keyboard.press("Tab");
      await expect(start).not.toBeFocused();
      // Leave the frame's navigation unfocused so Enter exercises the screen's global listener.
      await start.evaluate(() => {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      });

      await page.keyboard.press("Enter");

      await start.evaluate((element) => {
        if (element instanceof HTMLElement) {
          element.focus();
          element.click();
        }
      });

      await expect(start).not.toBeFocused();

      release.resolve(null);

      await expect(page.getByRole("region", { name: "Today's session" })).toContainText(
        "Goal B lesson",
      );

      await expect(page.getByRole("main")).not.toHaveAttribute("inert", "");
      await expect(notice).toHaveCount(0);

      await expect(page.getByRole("region", { name: "Your plan needs a document" })).toContainText(
        "Add your class material",
      );

      expect(await prisma.goal.findUniqueOrThrow({ where: { id: otherGoal.id } })).toMatchObject({
        dailyMinutes: 35,
        targetDate: null,
      });

      expect(
        await prisma.studySession.findUniqueOrThrow({ where: { id: session.id } }),
      ).toMatchObject({ startedAt: null });

      // Today follows the device's zone on mount; only switching may dispatch besides that sync.
      expect(actions.filter(({ body }) => !followBodies.has(body ?? ""))).toStrictEqual([
        { body: switchBody, id: expect.any(String) },
      ]);
    } finally {
      release.resolve(null);

      await testInfo.attach("goal-switch-actions", {
        body: JSON.stringify(actions, null, 2),
        contentType: "application/json",
      });

      await page.context().close();
    }
  });

  // Today's falling-behind card no longer moves the date itself (LEAD ruling A/A′: one link to
  // the plan editor's time a day), so its one write is the learner's answer: keeping their time.
  test("a failed notice acknowledgement says so, and nothing reads as saved", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "language" }, async ({ page, user }) => {
      const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: user.goalId } });
      const soon = new Date(toUTCMidnight(new Date()).getTime() + 5 * MS_PER_DAY);
      await prisma.goal.update({ data: { targetDate: soon }, where: { id: user.goalId } });

      const change = await planChangeFixture({
        kind: "missedDays",
        payload: {
          behind: {
            canFocus: false,
            coveredAfter: 0.1,
            coveredBefore: 0.12,
            currentMinutes: 25,
            measure: "goal",
          },
          days: 3,
          source: "system",
        },
        planId: plan.id,
        status: "applied",
      });

      await page.setViewportSize({ height: 900, width: 1280 });
      await page.goto("/today");
      const notice = page.getByRole("region", { name: "Plan change" });
      const keep = notice.getByRole("button", { name: "Keep my time" });
      await expect(keep).toBeVisible();

      // Only the acknowledgement fails, regardless of timezone-sync timing.
      const actions: (string | null)[] = [];
      const acknowledgement = [user.goalId, { changeId: change.id, status: "seen" }];
      const acknowledgementBody = JSON.stringify(acknowledgement);
      const followBody = JSON.stringify([{ goalId: user.goalId, timeZone: user.timeZone }]);

      await page.route("**/*", async (route) => {
        const request = route.request();

        if (request.method() === "POST" && request.headers()["next-action"]) {
          actions.push(request.postData());

          if (request.postData() === acknowledgementBody) {
            await route.abort();
            return;
          }
        }

        await route.fallback();
      });

      await keep.click();
      await expect(notice.getByRole("alert")).toHaveText("We couldn't save that. Try again.");
      await expect(notice.getByRole("status")).toHaveCount(0);

      // The learner's answer wasn't saved: the change still waits for it.
      const saved = await prisma.planChange.findUniqueOrThrow({ where: { id: change.id } });
      expect(saved.payload).not.toHaveProperty("seenAt", expect.any(String));

      expect(
        actions
          .filter((body) => body !== followBody)
          .map((body) => JSON.parse(body ?? "null") as unknown),
      ).toStrictEqual([acknowledgement]);
    });
  });

  for (const state of ["paused", "completed", "noGoal", "explanation"] as const) {
    test(`${state} Today paints from its prefetch`, async ({ browser }) => {
      const user = await createE2EUser(getBaseURL());

      if (state !== "noGoal") {
        const goal = await goalFixture({
          kind: state === "explanation" ? "explain" : "learn",
          status: state === "explanation" ? "active" : state,
          timezone: "America/Sao_Paulo",
          title: "Prefetched goal",
          userId: user.id,
        });

        await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });
      }

      const page = await openAs(browser, user);
      await page.setViewportSize({ height: 900, width: 1280 });

      const prefetched = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname.endsWith("/today") &&
          response.request().headers().rsc === "1",
      );

      await page.goto("/settings");
      await expect(page.getByRole("heading", { level: 1, name: "Profile" })).toBeVisible();
      const response = await prefetched;
      await response.finished();

      await instant(page, async () => {
        await page.getByRole("link", { name: /^Today/u }).click();
        await expect(page.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();

        if (state === "paused" || state === "completed") {
          await expect(
            page.getByText(
              state === "paused" ? "Prefetched goal is paused." : "You finished Prefetched goal.",
              { exact: true },
            ),
          ).toBeVisible();
        } else {
          await expect(page.getByRole("textbox", { name: "I want to" })).toBeVisible();

          if (state === "explanation") {
            await expect(page.getByRole("link", { name: "Continue explanation" })).toBeVisible();
          }
        }
      });

      await page.context().close();
    });
  }
});
