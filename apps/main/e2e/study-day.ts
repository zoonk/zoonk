import { randomUUID } from "node:crypto";
import { type Browser, type Page, expect } from "@playwright/test";
import { getFreePlanLimits } from "@zoonk/core/entitlements/plan-limits";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { type E2EUser, createE2EUser } from "@zoonk/e2e/fixtures/users";
import {
  goalFixture,
  planChangeFixture,
  planFixture,
  planItemFixture,
} from "@zoonk/testing/fixtures/goals";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { playableStepContent } from "@zoonk/testing/fixtures/playable-step-contents";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { MS_PER_DAY, toUTCMidnight } from "@zoonk/utils/date";

const DAYS_TO_EXAM = 32;
const TIME_MACHINE_DAYS_AGO = 4;
const SHORT_ID_LENGTH = 6;

const LESSON_TITLE = "Discounts in your head";
const LESSON_CAN_DO = "You'll work out a discount in your head";

/** A written lesson with one check, or one still waiting to be written. */
async function createLesson({ written }: { written: boolean }) {
  const lesson = { canDo: LESSON_CAN_DO, estimatedMinutes: 3, title: LESSON_TITLE };

  if (!written) {
    return libraryLessonFixture(lesson);
  }

  const playable = await playableLessonFixture({ lesson, steps: ["check"] });
  return playable.lesson;
}

/**
 * Writes the day's unwritten lesson the way the API's run does: its screen straight to the
 * database, then the lesson marked written, from outside this app's cache.
 */
export async function writeStudyLesson(lessonId: string) {
  await libraryStepFixture({
    content: playableStepContent.check,
    kind: "check",
    lessonId,
    position: 0,
  });

  await prisma.lesson.update({ data: { contentStatus: "completed" }, where: { id: lessonId } });
}

async function createContent({ writtenLesson }: { writtenLesson: boolean }) {
  const [percentages, discounts, lesson] = await Promise.all([
    skillFixture({ name: `Percentages ${randomUUID()}` }),
    skillFixture({ name: `Discounts ${randomUUID()}` }),
    createLesson({ written: writtenLesson }),
  ]);

  const [items] = await Promise.all([
    Promise.all(
      ["Capsule one", "Capsule two", "Practice one", "Practice two"].map((label) =>
        itemFixture({
          content: choiceItemContent(`${label}: ${randomUUID()}?`),
          skillId: percentages.id,
        }),
      ),
    ),
    lessonSkillFixture({ lessonId: lesson.id, skillId: discounts.id }),
  ]);

  return { discounts, items, lesson, percentages };
}

type StudyDayOptions = {
  /** Zu, the default buddy, picked in onboarding. */
  buddy?: boolean;
  freshStart?: "newWeek" | "welcomeBack" | null;
  /** The capsules already played, so the session opens on its lesson. */
  reviewDone?: boolean;
  /** False for a lesson not written yet: the session asks for it when the learner starts it. */
  writtenLesson?: boolean;
};

/**
 * A learner whose exam is 32 days away, with today's session already
 * built in the session shape: capsules first (two quick questions, one with a time machine), a
 * short lesson with one check, then mixed practice. The right option is always the first.
 */
export async function createStudyDay({
  buddy = false,
  freshStart = null,
  reviewDone = false,
  writtenLesson = true,
}: StudyDayOptions = {}) {
  const [user, content] = await Promise.all([
    createE2EUser(getBaseURL()),
    createContent({ writtenLesson }),
  ]);

  const { discounts, items, lesson, percentages } = content;

  const goal = await goalFixture({
    dailyMinutes: 10,
    kind: "exam",
    targetDate: new Date(toUTCMidnight(new Date()).getTime() + DAYS_TO_EXAM * MS_PER_DAY),
    timezone: "UTC",
    title: `E2E exam ${randomUUID().slice(0, SHORT_ID_LENGTH)}`,
    userId: user.id,
  });

  const plan = await planFixture({ goalId: goal.id });

  const [planItem, session] = await Promise.all([
    planItemFixture({
      kind: "lesson",
      lessonId: lesson.id,
      planId: plan.id,
      position: 0,
      titleSnapshot: lesson.title,
    }),
    studySessionFixture({ freshStart, goalId: goal.id, plannedMinutes: 7, userId: user.id }),
    learningProfileFixture({
      activeGoalId: goal.id,
      userId: user.id,
      ...(buddy ? { buddyGlasses: "round" as const, buddyKind: "zu" as const } : {}),
    }),
    attemptFixture({
      answer: { selectedIndex: 1 },
      answeredAt: new Date(Date.now() - TIME_MACHINE_DAYS_AGO * MS_PER_DAY),
      isCorrect: false,
      itemId: items[0]?.id,
      skillId: percentages.id,
      userId: user.id,
    }),
  ]);

  const [capsuleOne, capsuleTwo, practiceOne, practiceTwo] = items.map((item) => item.id);

  await Promise.all([
    studySessionBlockFixture({
      estimatedMinutes: 2,
      kind: "review",
      payload: {
        capsules: [
          {
            format: "rapidFire",
            itemIds: [capsuleOne, capsuleTwo],
            key: `skill:${percentages.id}`,
            lessonId: null,
            skillIds: [percentages.id],
            title: "Percentages",
          },
        ],
        skillIds: [percentages.id],
      },
      position: 0,
      sessionId: session.id,
      ...(reviewDone ? { status: "completed" as const } : {}),
    }),
    studySessionBlockFixture({
      canDo: LESSON_CAN_DO,
      estimatedMinutes: 3,
      kind: "learn",
      lessonId: lesson.id,
      payload: { planItemId: planItem.id, skillIds: [discounts.id], title: lesson.title },
      position: 1,
      sessionId: session.id,
    }),
    studySessionBlockFixture({
      estimatedMinutes: 2,
      kind: "practice",
      payload: { itemIds: [practiceOne, practiceTwo], skillIds: [percentages.id] },
      position: 2,
      sessionId: session.id,
    }),
  ]);

  return { goal, lesson, session, user };
}

/**
 * Lessons earlier days left, as the plan's last new-day settling carried them: written lessons of 3
 * minutes each that today's time didn't fit, first on tomorrow's plan. Returns them in plan order.
 */
export async function carryLessons({ count, goalId }: { count: number; goalId: string }) {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId } });

  const lessons = await Promise.all(
    Array.from({ length: count }, (_, index) =>
      playableLessonFixture({
        lesson: { estimatedMinutes: 3, title: `Missed lesson ${index + 1}` },
        steps: ["check"],
      }),
    ),
  );

  const items = await Promise.all(
    lessons.map(({ lesson }, index) =>
      planItemFixture({
        kind: "lesson",
        lessonId: lesson.id,
        planId: plan.id,
        position: index + 1,
        scheduledFor: new Date(toUTCMidnight(new Date()).getTime() + MS_PER_DAY),
        titleSnapshot: lesson.title,
      }),
    ),
  );

  await planChangeFixture({
    kind: "missedDays",
    payload: { carriedItemIds: items.map((item) => item.id), days: 1, source: "system" },
    planId: plan.id,
  });

  return lessons.map(({ lesson }) => lesson);
}

/** Moves a free exam goal's start back, so its free first week of exam prep is over. */
export async function pastFreeWeek(goalId: string) {
  const days = getFreePlanLimits().examPrepDays ?? 0;

  await prisma.goal.update({
    data: { createdAt: new Date(Date.now() - (days + 1) * MS_PER_DAY) },
    where: { id: goalId },
  });
}

/** A mission as a session stores it when its day is built (core's `MissionPick`). */
type StoredMission = {
  anchor: Record<string, string>;
  detail?: Record<string, number | string>;
  firstStep?: boolean;
  kind: string;
  opens?: Record<string, string>;
  total: number;
};

/**
 * Gives a test day the missions a session picks when it's built, instead of the ones a session
 * from before stored picks reads from its blocks.
 */
export async function saveMissions(sessionId: string, picks: StoredMission[]) {
  await prisma.studySession.update({
    data: { missions: { picks, version: 1 } },
    where: { id: sessionId },
  });
}

/**
 * Opens a page signed in as the learner, in a browser context of its own that closes when the test
 * ends (`closeOpenedContexts`).
 */
export async function openAs(browser: Browser, user: E2EUser): Promise<Page> {
  const context = await browser.newContext({ storageState: user.storageState });
  return context.newPage();
}

/**
 * Waits for the grade, then continues with Enter. Its listener attaches right after the grade
 * shows, so the press retries until the feedback goes away.
 */
async function continueWithEnter(page: Page) {
  const feedback = page.getByRole("region", { name: "Answer feedback" });
  await expect(feedback.getByText("Correct!")).toBeVisible();

  await expect(async () => {
    await page.keyboard.press("Enter");
    await expect(feedback).toBeHidden({ timeout: 1000 });
  }).toPass({ timeout: 5000 });
}

/** Checks the picked answer with Enter, once the pinned Check is ready for it. */
export async function checkWithEnter(page: Page) {
  await expect(page.getByRole("button", { name: /^Check/u })).toBeEnabled();
  await page.keyboard.press("Enter");
}

/**
 * Answers a quick question with its first option (always the right one): its number picks it and
 * Enter checks it, as in the lesson. Then it moves on.
 */
export async function answerRight(page: Page, question: RegExp | string) {
  await expect(page.getByRole("heading", { name: question })).toBeVisible();
  await page.keyboard.press("1");
  await checkWithEnter(page);
  await continueWithEnter(page);
}
