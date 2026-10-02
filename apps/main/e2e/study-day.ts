import { randomUUID } from "node:crypto";
import { type Browser, type Page, expect } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { type E2EUser, createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { playableStepContent } from "@zoonk/testing/fixtures/playable-step-contents";
import { dailyProgressFixtureMany } from "@zoonk/testing/fixtures/progress";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { MS_PER_DAY, toUTCMidnight } from "@zoonk/utils/date";
import { type Mode } from "./learn-personas";

export const DAYS_TO_EXAM = 32;
const TIME_MACHINE_DAYS_AGO = 4;
const SHORT_ID_LENGTH = 6;

export const LESSON_TITLE = "Discounts in your head";
export const LESSON_CAN_DO = "You'll work out a discount in your head";

/** A written lesson with one check, or one still waiting to be written. */
async function createLesson({ written }: { written: boolean }) {
  const lesson = { canDo: LESSON_CAN_DO, title: LESSON_TITLE };

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
  /** A day studied before today, so Fun shows its missions. */
  earlierStudyDay?: boolean;
  freshStart?: "newWeek" | "welcomeBack" | null;
  mode: Mode;
  /** The capsules already played, so the session opens on its lesson. */
  reviewDone?: boolean;
  /** False for a lesson still being written, so the session has to wait for it. */
  writtenLesson?: boolean;
};

/**
 * A learner in Focus or Fun (with Zu) whose exam is 32 days away, with today's session already
 * built in the session shape: capsules first (two quick questions, one with a time machine), a
 * short lesson with one check, then mixed practice. The right option is always the first.
 */
export async function createStudyDay({
  earlierStudyDay = false,
  freshStart = null,
  mode,
  reviewDone = false,
  writtenLesson = true,
}: StudyDayOptions) {
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
      experienceMode: mode,
      userId: user.id,
      ...(mode === "fun" ? { buddyGlasses: "round", buddyKind: "zu" } : {}),
    }),
    attemptFixture({
      answer: { selectedIndex: 1 },
      answeredAt: new Date(Date.now() - TIME_MACHINE_DAYS_AGO * MS_PER_DAY),
      isCorrect: false,
      itemId: items[0]?.id,
      skillId: percentages.id,
      userId: user.id,
    }),
    earlierStudyDay &&
      dailyProgressFixtureMany([
        {
          date: new Date(toUTCMidnight(new Date()).getTime() - MS_PER_DAY),
          timeSpentSeconds: 600,
          userId: user.id,
        },
      ]),
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

/** Opens a page as the learner in UTC, the goal's timezone, so the day never shifts at midnight. */
export async function openAs(browser: Browser, user: E2EUser): Promise<Page> {
  const context = await browser.newContext({ storageState: user.storageState, timezoneId: "UTC" });
  return context.newPage();
}

/**
 * Waits for the grade, then continues with Enter. Its listener attaches right after the grade
 * shows, so the press retries until the feedback goes away.
 */
export async function continueWithEnter(page: Page) {
  const feedback = page.getByRole("region", { name: "Answer feedback" });
  await expect(feedback.getByText("Correct!")).toBeVisible();

  await expect(async () => {
    await page.keyboard.press("Enter");
    await expect(feedback).toBeHidden({ timeout: 1000 });
  }).toPass({ timeout: 5000 });
}

/** Answers a quick question with its first option (always the right one) and moves on. */
export async function answerRight(page: Page, question: RegExp | string) {
  await expect(page.getByRole("heading", { name: question })).toBeVisible();
  await page.keyboard.press("1");
  await continueWithEnter(page);
}
