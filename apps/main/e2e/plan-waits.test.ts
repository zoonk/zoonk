import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { toUTCMidnight } from "@zoonk/utils/date";
import { expect, test } from "./fixtures";
import { type StreamEvent, followRun } from "./generation-run";
import { MODES, type Mode } from "./learn-personas";
import { createStudyDay, openAs } from "./study-day";

/**
 * The plan's waits move on by themselves: while the goal's run builds the plan, `/plan` follows it
 * and shows the plan once it's saved; stand-ins for lessons still being written turn into their
 * chapter once its outline lands, without a refresh.
 */

/** Stand-ins are read again every 10 seconds, so a landed outline shows within a couple of rounds. */
const WRITTEN_WITHIN_MS = 25_000;

/** A learner in `mode` whose active goal has a plan, built or not. */
async function createPlanLearner({ mode, runId }: { mode: Mode; runId?: string }) {
  const user = await createE2EUser(getBaseURL());

  const goal = await goalFixture({
    generationRunId: runId ?? null,
    timezone: "UTC",
    title: `Ratios ${randomUUID().slice(0, 6)}`,
    userId: user.id,
  });

  await learningProfileFixture({
    activeGoalId: goal.id,
    experienceMode: mode,
    userId: user.id,
    ...(mode === "fun" ? { buddyKind: "zu" } : {}),
  });

  return { goal, user };
}

/** A plan without a deadline: "Your plan" in Focus, the Route in Fun. */
function planHeading(mode: Mode) {
  return mode === "fun" ? "Route" : "Your plan";
}

test.describe("The plan being built", () => {
  for (const mode of MODES) {
    test(`follows the plan being built and shows it on its own (${mode})`, async ({ browser }) => {
      const runId = `e2e-plan-${randomUUID()}`;
      const { goal, user } = await createPlanLearner({ mode, runId });
      const plan = await planFixture({ goalId: goal.id, phases: [] });

      const events: StreamEvent[] = [
        { entityId: goal.id, status: "started", step: "understandGoal" },
        { entityId: goal.id, status: "started", step: "buildSkillGraph" },
      ];

      const page = await openAs(browser, user);
      await followRun({ events, page, runId });
      await page.goto("/plan");

      await expect(
        page.getByRole("heading", { level: 1, name: "Building your plan" }),
      ).toBeVisible();

      await expect(page.getByRole("progressbar", { name: "Building your plan" })).toBeVisible();

      const phases = page.getByRole("list", { name: "Building your plan" });
      await expect(phases.getByRole("listitem").nth(0)).toHaveText("Reading your goal, done");

      // The run saves the plan: its stream says so and the plan shows without a refresh.
      await Promise.all([
        prisma.plan.update({
          data: { phases: [{ name: "Foundations", summary: "The basics first" }] },
          where: { id: plan.id },
        }),
        planItemFixture({ planId: plan.id, titleSnapshot: "Equivalent ratios" }),
      ]);

      events.push(
        { entityId: goal.id, status: "completed", step: "buildSkillGraph" },
        { entityId: goal.id, status: "completed", step: "createPlan" },
      );

      await expect(page.getByRole("heading", { level: 1, name: planHeading(mode) })).toBeVisible();
      await page.context().close();
    });
  }

  test("says when building the plan failed and starts it again on a tap", async ({ browser }) => {
    const runId = `e2e-plan-${randomUUID()}`;
    const { goal, user } = await createPlanLearner({ mode: "focus", runId });
    await planFixture({ goalId: goal.id, phases: [] });

    const page = await openAs(browser, user);

    await followRun({
      events: [
        { entityId: goal.id, status: "started", step: "understandGoal" },
        { entityId: goal.id, reason: "aiGenerationFailed", status: "error", step: "workflowError" },
      ],
      page,
      runId,
    });

    await page.goto("/plan");

    const failed = page.getByRole("alert").filter({ hasText: "This didn't finish" });
    await expect(failed).toBeVisible();
    await failed.getByRole("button", { name: "Try again" }).click();

    // The tap starts the run again: the wait follows it, or says the start failed with a way out.
    await expect(failed).toBeHidden();

    await expect(
      page
        .getByRole("progressbar", { name: "Building your plan" })
        .or(page.getByRole("alert").filter({ hasText: "This didn't start" })),
    ).toBeVisible();

    await page.context().close();
  });
});

/**
 * A plan whose first lessons stand in for a skill until its outline lands (no lesson, no chapter),
 * scheduled today, and the outline that lands for them.
 */
async function createPlanBeingWritten(goalId: string) {
  const suffix = randomUUID().slice(0, 6);

  const [plan, skill, chapter, lesson] = await Promise.all([
    planFixture({ goalId }),
    skillFixture({ name: `Unit rates ${suffix}` }),
    libraryChapterFixture({ title: `Rates and ratios ${suffix}` }),
    libraryLessonFixture({ title: `What a unit rate is ${suffix}` }),
  ]);

  const standIn = await planItemFixture({
    planId: plan.id,
    scheduledFor: toUTCMidnight(new Date()),
    skillId: skill.id,
    titleSnapshot: "",
  });

  /** The outline lands the way the API's run writes it: the stand-in gets its lesson and chapter. */
  const landOutline = () =>
    prisma.planItem.update({
      data: { chapterId: chapter.id, lessonId: lesson.id, titleSnapshot: lesson.title },
      where: { id: standIn.id },
    });

  return { chapter, landOutline, lesson };
}

test.describe("Lessons being written in the plan", () => {
  test("a chapter being written turns into its chapter on its own (focus)", async ({ browser }) => {
    const { goal, user } = await createPlanLearner({ mode: "focus" });
    const { chapter, landOutline } = await createPlanBeingWritten(goal.id);

    const page = await openAs(browser, user);
    await page.goto("/plan");

    await expect(page.getByText("Lessons being written")).toBeVisible();

    await landOutline();

    await expect(page.getByRole("link", { exact: true, name: chapter.title })).toBeVisible({
      timeout: WRITTEN_WITHIN_MS,
    });

    await expect(page.getByText("Lessons being written")).toBeHidden();
    await page.context().close();
  });

  test("a stop being written this week turns into its lesson on its own (fun)", async ({
    browser,
  }) => {
    const { goal, user } = await createPlanLearner({ mode: "fun" });
    const { landOutline, lesson } = await createPlanBeingWritten(goal.id);

    const page = await openAs(browser, user);
    await page.goto("/plan");

    const week = page.getByRole("region", { name: "This week" });
    await expect(week.getByRole("listitem", { name: /Lessons being written/u })).toBeVisible();

    await landOutline();

    await expect(week.getByRole("listitem", { name: new RegExp(lesson.title, "u") })).toBeVisible({
      timeout: WRITTEN_WITHIN_MS,
    });

    await page.context().close();
  });
});

/** An own-words edit waits this long before saying it's slow, and stops waiting after this long. */
const EDIT_SLOW_MS = 8000;
const EDIT_TIME_LIMIT_MS = 45_000;

test.describe("An own-words plan edit that hangs", () => {
  for (const mode of MODES) {
    test(`says so, then lets the learner try again (${mode})`, async ({ browser }) => {
      const { user } = await createStudyDay({ mode });
      const page = await openAs(browser, user);
      const { promise: hung } = Promise.withResolvers<null>();

      // The edit's Server Action never answers, as when the server is stuck.
      await page.route(
        (url) => url.pathname.endsWith("/plan"),
        async (route) => {
          if (route.request().method() === "POST" && route.request().headers()["next-action"]) {
            await hung;
          }

          await route.fallback();
        },
      );

      await page.clock.install();
      await page.goto("/plan");

      await page.getByRole("button", { name: "Change your plan" }).click();
      await page.getByLabel("Change it in your own words").fill("Less on weekends");
      await page.getByRole("button", { name: "Change my plan" }).click();
      await expect(page.getByRole("button", { name: "Changing…" })).toBeVisible();
      await page.clock.fastForward(EDIT_SLOW_MS + 1000);

      await expect(
        page.getByText("Still changing your plan. This is taking longer than usual."),
      ).toBeVisible();

      await page.clock.fastForward(EDIT_TIME_LIMIT_MS);

      await expect(
        page.getByText("This took too long. If your plan doesn't change in a moment, try again."),
      ).toBeVisible();

      // What they wrote stays, and the button sends it again.
      await expect(page.getByLabel("Change it in your own words")).toHaveValue("Less on weekends");
      await expect(page.getByRole("button", { name: "Change my plan" })).toBeEnabled();
      await page.context().close();
    });
  }
});
