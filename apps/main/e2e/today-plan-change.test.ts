import { randomUUID } from "node:crypto";
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
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { toUTCMidnight } from "@zoonk/utils/date";
import { expect, test } from "./fixtures";
import { tabTo } from "./keyboard-focus";
import { asPersona } from "./learn-personas";
import { openAs } from "./study-day";

/** What the plan-edit model said of the learner's words, stored with the change. */
const PROPOSAL = "Twenty-five minutes a day keeps your plan on track for the exam.";

/** What the card says instead: the change's own operation, never the model's summary of it. */
const PROPOSAL_CARD = "Daily time changed to 25 min.";
const DAYS_PER_WEEK = 7;
const STUDY_MINUTES = 30;
const LESSONS = 3;

function readChangeStatus(changeId: string) {
  return prisma.planChange
    .findUniqueOrThrow({ where: { id: changeId } })
    .then((change) => change.status);
}

/**
 * A learner whose plan the planner owns (a skill graph and settings), with one chapter of three
 * lessons, so a test-out's skip and its undo re-plan around them.
 */
async function createChapterPlan() {
  const user = await createE2EUser(getBaseURL());
  const suffix = randomUUID().slice(0, 6);
  const indexes = Array.from({ length: LESSONS }, (_, index) => index);

  const [goal, chapter, skills, lessons] = await Promise.all([
    goalFixture({ timezone: "UTC", title: `Circuits ${suffix}`, userId: user.id }),
    libraryChapterFixture({ title: `Electric circuits ${suffix}` }),
    Promise.all(indexes.map((index) => skillFixture({ name: `Circuit skill ${index} ${suffix}` }))),
    Promise.all(
      indexes.map((index) => libraryLessonFixture({ title: `Circuit lesson ${index} ${suffix}` })),
    ),
  ]);

  const [plan] = await Promise.all([
    planFixture({
      goalId: goal.id,
      graph: {
        phases: [{ milestone: null, name: "Circuits" }],
        skills: skills.map((skill) => ({
          area: null,
          lessons: 1,
          name: skill.name,
          phase: 0,
          skillId: skill.id,
          weight: null,
        })),
      },
      settings: {
        startDate: toUTCMidnight(new Date()).toISOString().slice(0, "YYYY-MM-DD".length),
        weekdayMinutes: Array.from({ length: DAYS_PER_WEEK }, () => STUDY_MINUTES),
      },
    }),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    prisma.lessonSkill.createMany({
      data: lessons.map((lesson, index) => ({
        lessonId: lesson.id,
        skillId: skills[index]?.id ?? "",
      })),
    }),
  ]);

  const items = await Promise.all(
    lessons.map((lesson, position) =>
      planItemFixture({
        chapterId: chapter.id,
        lessonId: lesson.id,
        planId: plan.id,
        position,
        titleSnapshot: lesson.title,
      }),
    ),
  );

  return { chapter, goal, items, plan, user };
}

/**
 * Today's notice is the one place to answer a plan change: any proposal waiting for an OK, and the
 * automatic changes of the last day, with their undo while the plan is still as they left it.
 */
test.describe("Today's plan change", () => {
  test("applies a proposal from the plan's assistant right on Today, by keyboard", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
      const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: user.goalId } });

      const change = await planChangeFixture({
        kind: "edited",
        payload: { operations: [{ kind: "setDailyMinutes", minutes: 25 }], source: "planEdit" },
        planId: plan.id,
        reason: PROPOSAL,
        status: "proposed",
      });

      await page.goto("/today");

      const note = page.getByRole("region", { name: "Suggested change" });
      await expect(note).toContainText(PROPOSAL_CARD);
      await expect(note).not.toContainText(PROPOSAL);

      // Nothing changes before the learner's OK.
      expect(await readChangeStatus(change.id)).toBe("proposed");

      await tabTo(page, note.getByRole("button", { name: "Apply" }));
      await page.keyboard.press("Enter");

      // The answer says what it did, where the buttons were, and focus stays on the note: today's
      // session wasn't started, so it follows the change.
      await expect(note.getByRole("status")).toHaveText(
        "It's in your plan, and today's session follows it.",
      );

      await expect(note).toBeFocused();
      await expect(page).toHaveURL(/\/today$/u);

      await expect.poll(() => readChangeStatus(change.id)).toBe("applied");

      await expect
        .poll(async () => {
          const goal = await prisma.goal.findUniqueOrThrow({ where: { id: user.goalId } });
          return goal.dailyMinutes;
        })
        .toBe(25);
    });
  });

  test("answers each waiting proposal in turn, the buddy's and the exam notice's", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
      const [plan, goal] = await Promise.all([
        prisma.plan.findUniqueOrThrow({ where: { goalId: user.goalId } }),
        prisma.goal.findUniqueOrThrow({ where: { id: user.goalId } }),
      ]);

      const noticeDay = new Date((goal.targetDate ?? new Date()).getTime() + 7 * 86_400_000)
        .toISOString()
        .slice(0, "YYYY-MM-DD".length);

      // The persona's own waiting proposal is answered already, so only these two wait.
      await prisma.planChange.updateMany({
        data: { status: "declined" },
        where: { planId: plan.id, status: "proposed" },
      });

      // The notice's date came first; the buddy's time came later and changes something else.
      const notice = await planChangeFixture({
        createdAt: new Date(Date.now() - 60_000),
        kind: "edited",
        payload: {
          operations: [{ estimated: false, kind: "setNoticeDate", targetDate: noticeDay }],
          source: "notice",
        },
        planId: plan.id,
        reason: "",
        status: "proposed",
      });

      const time = await planChangeFixture({
        kind: "edited",
        payload: { operations: [{ kind: "setDailyMinutes", minutes: 25 }], source: "planEdit" },
        planId: plan.id,
        reason: PROPOSAL,
        status: "proposed",
      });

      await page.goto("/today");

      // The newest shows first, alone; the other waits without clutter.
      const note = page.getByRole("region", { name: "Suggested change" });
      await expect(note).toContainText(PROPOSAL_CARD);
      await expect(page.getByRole("button", { name: "Next suggestion" })).toHaveCount(0);

      await note.getByRole("button", { name: "Apply" }).click();
      await expect(note.getByRole("status")).toContainText("It's in your plan");
      await expect.poll(() => readChangeStatus(time.id)).toBe("applied");

      // Then the one still waiting, by keyboard: it takes the notice's place and focus.
      const next = note.getByRole("button", { name: "Next suggestion" });
      await tabTo(page, next);
      await page.keyboard.press("Enter");

      const noticeNote = page.getByRole("region", { name: "Suggested change" });
      await expect(noticeNote).toContainText(/^The exam notice puts the exam on /u);
      await expect(noticeNote).toBeFocused();

      await noticeNote.getByRole("button", { name: "Keep mine" }).click();
      await expect(noticeNote.getByRole("status")).toHaveText("Your plan stays as it was.");
      await expect.poll(() => readChangeStatus(notice.id)).toBe("declined");
      await expect(page.getByRole("button", { name: "Next suggestion" })).toHaveCount(0);
    });
  });

  test("asks before the exam notice's day moves the plan, and Keep mine keeps the learner's date", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
      const [plan, goal] = await Promise.all([
        prisma.plan.findUniqueOrThrow({ where: { goalId: user.goalId } }),
        prisma.goal.findUniqueOrThrow({ where: { id: user.goalId } }),
      ]);

      const noticeDay = new Date((goal.targetDate ?? new Date()).getTime() + 7 * 86_400_000)
        .toISOString()
        .slice(0, "YYYY-MM-DD".length);

      const change = await planChangeFixture({
        kind: "edited",
        payload: {
          operations: [{ estimated: false, kind: "setNoticeDate", targetDate: noticeDay }],
          source: "notice",
        },
        planId: plan.id,
        reason: "",
        status: "proposed",
      });

      await page.goto("/today");

      const note = page.getByRole("region", { name: "Suggested change" });
      await expect(note).toContainText(/^The exam notice puts the exam on /u);
      await expect(note.getByRole("button", { name: "Apply" })).toBeVisible();

      await note.getByRole("button", { name: "Keep mine" }).click();
      await expect(note.getByRole("status")).toHaveText("Your plan stays as it was.");

      await expect.poll(() => readChangeStatus(change.id)).toBe("declined");

      const kept = await prisma.goal.findUniqueOrThrow({ where: { id: user.goalId } });
      expect(kept.targetDate).toStrictEqual(goal.targetDate);
    });
  });

  test("says which chapter a test-out skipped and puts its lessons back on Undo", async ({
    browser,
  }) => {
    const { chapter, items, plan, user } = await createChapterPlan();
    const skipped = items.slice(0, 2).map((item) => item.id);

    await prisma.planItem.updateMany({
      data: { status: "testedOut" },
      where: { id: { in: skipped } },
    });

    // The plan re-plans around the skip when Today first opens, as the test-out does right away.
    const page = await openAs(browser, user);
    await page.goto("/today");
    await expect(page.getByRole("region", { name: "Today's session" })).toBeVisible();

    const { version } = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });

    const change = await planChangeFixture({
      kind: "testedOut",
      payload: { planItemIds: skipped, source: "system", versionAfter: version },
      planId: plan.id,
      reason: "Placement or a test-out skipped lessons the learner already knows.",
      status: "applied",
    });

    await page.reload();

    const note = page.getByRole("region", { name: "Plan change" });
    await expect(note).toContainText(`We skipped 2 lessons of ${chapter.title}`);
    await expect(note.getByRole("button", { name: "Got it" })).toBeVisible();

    await note.getByRole("button", { name: "Undo" }).click();
    await expect(note.getByRole("status")).toHaveText("The lessons are back in your plan.");

    await expect.poll(() => readChangeStatus(change.id)).toBe("undone");

    await expect
      .poll(() => prisma.planItem.count({ where: { id: { in: skipped }, status: "todo" } }))
      .toBe(skipped.length);

    // Answered, it leaves Today.
    await page.reload();
    await expect(page.getByRole("region", { name: "Plan change" })).toHaveCount(0);
    await page.context().close();
  });
});
