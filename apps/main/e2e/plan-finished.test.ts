import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { studySessionFixture } from "@zoonk/testing/fixtures/study-sessions";
import { MS_PER_DAY, toUTCMidnight } from "@zoonk/utils/date";
import { type Page, expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";
import { openAs } from "./study-day";
import { routeTimeToCover } from "./time-to-cover-routes";

/** A day `days` from today, as the plan dates its items. */
function inDays(days: number): Date {
  return toUTCMidnight(new Date(Date.now() + days * MS_PER_DAY));
}

/** A day as the plan dates its phases. */
function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * A learner who studied every lesson of a plan of three phases ahead of time: the first two each
 * close with a challenge on a later day, and their date left the third out of the plan.
 */
async function lessonsDoneLearner() {
  const user = await createE2EUser(getBaseURL());

  const [goal, chapters, skills] = await Promise.all([
    goalFixture({
      targetDate: inDays(14),
      timezone: "UTC",
      title: "Learn ratios",
      userId: user.id,
    }),
    Promise.all(["Ratios", "Rates"].map((title) => libraryChapterFixture({ title }))),
    Promise.all(["Compare ratios", "Find rates"].map((name) => skillFixture({ name }))),
  ]);

  const phases = [{ name: "Ratio basics" }, { name: "Rates" }, { name: "Speeds" }];

  // The plan as the planner lays one out, which is what the Plan reads it as: each phase's lesson
  // is a Library lesson that teaches its skill, and each phase it holds is dated from its lesson
  // to its challenge.
  const lessons = await Promise.all(
    chapters.map(async (chapter, phase) => {
      const lesson = await libraryLessonFixture({ homeChapterId: chapter.id });
      await lessonSkillFixture({ lessonId: lesson.id, skillId: skills[phase]?.id ?? "" });
      return lesson;
    }),
  );

  const [plan] = await Promise.all([
    planFixture({
      goalId: goal.id,
      graph: {
        phases,
        skills: skills.map((skill, phase) => ({
          area: "Ratios",
          lessons: 1,
          name: skill.name,
          phase,
          skillId: skill.id,
        })),
      },
      phases: phases.map((phase, index) => ({
        ...phase,
        endDate: index < 2 ? isoDay(inDays(index * 3 + 5)) : null,
        startDate: index < 2 ? isoDay(inDays(index * 3)) : null,
      })),
    }),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    studySessionFixture({ goalId: goal.id, userId: user.id }),
  ]);

  const items = await Promise.all(
    [0, 1].flatMap((phase) => [
      planItemFixture({
        chapterId: chapters[phase]?.id,
        lessonId: lessons[phase]?.id,
        phase,
        planId: plan.id,
        position: phase * 2,
        scheduledFor: inDays(phase * 3),
        skillId: skills[phase]?.id,
        status: "done",
      }),
      planItemFixture({
        kind: "boss",
        phase,
        planId: plan.id,
        position: phase * 2 + 1,
        scheduledFor: inDays(phase * 3 + 5),
        titleSnapshot: `Challenge ${String(phase + 1)}`,
      }),
    ]),
  );

  await planItemFixture({
    kind: "review",
    phase: 1,
    planId: plan.id,
    position: 4,
    scheduledFor: inDays(12),
  });

  return {
    bosses: items.filter((item) => item.kind === "boss"),
    goalId: goal.id,
    planId: plan.id,
    user,
  };
}

function standingNumbers(page: Page) {
  return page.locator('[data-slot="journey-standing"]').filter({ visible: true });
}

function journeyPath(page: Page) {
  return page.getByRole("list", { name: "Your path" });
}

/** A saved challenge's date, independently of whether its lessons were completed ahead. */
function challengeDay(date: Date | null | undefined) {
  if (!date) {
    throw new Error("Expected a dated phase challenge");
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    ...(date.getUTCFullYear() !== new Date().getUTCFullYear() && { year: "numeric" }),
  }).format(date);
}

async function openPlan(page: Page) {
  await page.goto("/plan");
  await expect(page.locator('[data-slot="journey"]')).toBeVisible();
}

/** The learner moves their goal's date `days` away in "Adjust plan": a change of their own. */
async function moveDate(page: Page, { days, goalId }: { days: number; goalId: string }) {
  const deadline = isoDay(inDays(days));

  await page
    .getByRole("region", { exact: true, name: "Your plan" })
    .getByRole("button", { name: /^Goal date/u })
    .click();

  const editor = page.getByRole("dialog", { name: "Adjust your plan" });
  await editor.getByLabel("Deadline").fill(deadline);
  await editor.getByRole("button", { name: "Save" }).click();

  await expect
    .poll(async () => {
      const goal = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });
      return goal.targetDate?.toISOString().slice(0, 10);
    })
    .toBe(deadline);
}

/** The lessons of the goal's plan still to study. */
function countLessonsLeft(goalId: string) {
  return prisma.planItem.count({
    where: { kind: { in: ["chapter", "lesson"] }, plan: { goalId }, status: "todo" },
  });
}

/*
 * Pedro's plan read "Finished" and "Continue at Beginner" beside "0 of 4 phases done": every
 * lesson was done, and a phase is done with its challenge. "Finished" now means one thing on
 * every surface: every lesson and every challenge, so the number, the pace, the phases and what's
 * next agree.
 */
test.describe("A plan whose lessons are all done", () => {
  test("isn't finished while its challenges are left, and is once they're won, paused too", async ({
    browser,
  }) => {
    const { bosses, goalId, planId, user } = await lessonsDoneLearner();
    const page = await openAs(browser, user);
    await page.setViewportSize({ height: 900, width: 1440 });
    await openPlan(page);

    // The number is the lessons, all done; nothing says finished or offers what's next.
    await expect(standingNumbers(page)).toContainText(/Progress\s*100%\s*2 of 2 lessons/u);

    await expect(
      page.getByRole("button", { exact: true, name: "Pace Challenges 2 challenges left" }),
    ).toBeVisible();

    await expect(page.getByRole("button", { exact: true, name: "Pace Finished" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "You finished your plan" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Continue at/u })).toHaveCount(0);

    // A phase is done with its challenge; the one the plan holds nothing of isn't counted.
    await expect(page.getByText("0 of 2 phases done", { exact: true })).toBeVisible();

    const leftOut = journeyPath(page).locator(":scope > li", { hasText: "Speeds" });
    await expect(leftOut).toHaveAttribute("data-state", "leftOut");
    await expect(leftOut.getByText("Not in your plan", { exact: true })).toBeVisible();
    await expect(leftOut).not.toContainText(", done");

    // C2 removes early reach: completing lessons ahead preserves the actual future challenge day.
    const next = page.getByRole("region", { name: "Next on your path" });

    await expect(next.getByRole("link", { name: /Phase challenge/u })).toContainText(
      challengeDay(bosses[0]?.scheduledFor),
    );

    // The later challenge keeps its saved day too, on the Plan and its own page.
    const ratesBand = page.getByRole("button", { exact: true, name: "Rates" });
    await ratesBand.click();

    await expect(
      page.getByRole("link", { name: `Phase challenge ${challengeDay(bosses[1]?.scheduledFor)}` }),
    ).toBeVisible();

    await page.goto(`/challenge/${bosses[1]?.id ?? ""}`);
    await expect(page.getByText("Opens in 8 days", { exact: true })).toBeVisible();

    // Days away, both their days gone after the lessons they test: the next session duels them
    // both, and neither reads a day.
    await Promise.all([
      prisma.planItem.updateMany({
        data: { scheduledFor: inDays(-2) },
        where: { id: { in: bosses.map((boss) => boss.id) } },
      }),
      prisma.planItem.updateMany({
        data: { completedAt: inDays(-3) },
        where: { kind: "lesson", planId },
      }),
    ]);

    await openPlan(page);

    await expect(next.getByRole("link", { name: /Phase challenge/u })).toContainText(
      "In your next session",
    );

    await ratesBand.click();

    await expect(
      page.getByRole("dialog").getByRole("link", { name: "Phase challenge In your next session" }),
    ).toBeVisible();

    await page.keyboard.press("Escape");

    await prisma.planItem.updateMany({
      data: { completedAt: new Date(), status: "done" },
      where: { id: { in: bosses.map((boss) => boss.id) } },
    });

    await page.reload();

    // Finished, its pace reads "Finished", never days ahead of dates it no longer needs, on the
    // Plan, its pace sheet and Today.
    const pace = page.getByRole("button", { exact: true, name: "Pace Finished" });
    const paceSheet = page.getByRole("dialog", { name: "Your pace" });
    await expect(page.getByRole("region", { name: "You finished your plan" })).toBeVisible();
    await expect(page.getByText("2 of 2 phases done", { exact: true })).toBeVisible();
    await expect(leftOut).toHaveAttribute("data-state", "leftOut");
    await pace.click();
    await expect(paceSheet.getByText("Plan finished", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");

    // Today reads the same core status.
    await page.goto("/today");
    await expect(page.getByText(/Plan finished/u)).toBeVisible();

    // A paused goal still keeps its finished plan's pace on a return visit.
    await prisma.goal.update({ data: { status: "paused" }, where: { id: goalId } });
    await page.setViewportSize({ height: 844, width: 390 });
    await openPlan(page);
    await pace.click();
    await expect(paceSheet.getByText("Plan finished", { exact: true })).toBeVisible();

    await page.context().close();
  });

  // Pedro moved his date closer, which left topics out, then studied every lesson it held ahead of
  // time. His own time now fitted them, yet his Plan offered "10 min a day covers everything"
  // beside his 15, and a won challenge added lessons behind his back. The Plan offers what his
  // time fits, at his time, with its diff, Apply and Undo.
  // Lucas's near date fitted part of his course. Once he finished what it held, his Plan offered
  // the next level first and the rest of this goal second; a unit is finished before the next one
  // starts (Duolingo, Khan Academy), so the rest comes first and the next level a few pages later.
  test("offers the lessons the learner's own time fits once every lesson is done, and the rest of the goal before the next level once every challenge is too", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "buddy" }, async ({ page, user }) => {
      await page.setViewportSize({ height: 900, width: 1440 });
      await openPlan(page);

      // He moves his date three days away: the plan keeps what fits and leaves the rest out.
      await moveDate(page, { days: 3, goalId: user.goalId });

      // He studies every lesson it holds; its challenges are still to win.
      await prisma.planItem.updateMany({
        data: { completedAt: new Date(), status: "done" },
        where: {
          kind: { in: ["chapter", "lesson"] },
          plan: { goalId: user.goalId },
          status: "todo",
        },
      });

      await openPlan(page);

      const slot = page.getByRole("group", { name: "Plan suggestion" }).filter({ visible: true });
      const firstLine = slot.locator('[data-slot="diff-lines"]').getByRole("listitem").first();

      // Never less time framed as covering more; the diff leads with the lessons it brings in.
      await expect(slot).not.toContainText(/a day covers/u);
      await expect(firstLine).toHaveText(/Adds (?:about )?\d+ lessons?$/u);
      await slot.getByRole("button", { exact: true, name: "Apply" }).click();

      await expect(slot.getByText("Plan updated", { exact: true })).toBeVisible();
      await expect.poll(() => countLessonsLeft(user.goalId)).toBeGreaterThan(0);

      // Undo puts the plan back, and the offer with it.
      await slot.getByRole("button", { exact: true, name: "Undo" }).click();
      await expect.poll(() => countLessonsLeft(user.goalId)).toBe(0);
      await expect(firstLine).toHaveText(/Adds (?:about )?\d+ lessons?$/u);
      await expect(slot.getByRole("button", { exact: true, name: "Apply" })).toBeVisible();

      // He wins every challenge too: everything the plan holds is done.
      await prisma.planItem.updateMany({
        data: { completedAt: new Date(), status: "done" },
        where: { plan: { goalId: user.goalId }, status: "todo" },
      });

      // Standing in for the API: Find finds that 55 minutes a day cover everything.
      const goal = await prisma.goal.findUniqueOrThrow({ where: { id: user.goalId } });

      await routeTimeToCover(page, {
        goalId: user.goalId,
        time: {
          recommendedMinutes: 55,
          targetDate: goal.targetDate?.toISOString().slice(0, 10) ?? null,
        },
      });

      await openPlan(page);
      const finished = slot.getByRole("region", { name: "You finished your plan" });

      // First what his own time fits of the rest by his date, then what his time covers, with the
      // time that covers it all when he asks, and only then the next level.
      await expect(slot.getByText("1 of 3").filter({ visible: true })).toBeVisible();
      await expect(firstLine).toHaveText(/Adds (?:about )?\d+ lessons?$/u);
      await expect(finished).toHaveCount(0);
      await slot.getByRole("button", { exact: true, name: "Next" }).click();

      await slot
        .getByRole("button", { name: "Find the time that covers everything" })
        .filter({ visible: true })
        .click();

      await expect(slot.getByRole("heading").filter({ visible: true })).toHaveText(
        "55 min a day covers everything in depth",
      );

      await slot.getByRole("button", { exact: true, name: "Next" }).click();
      await expect(finished.getByRole("button", { name: "Continue at Beginner" })).toBeVisible();
    });
  });
});
