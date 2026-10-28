import { randomUUID } from "node:crypto";
import { type Browser } from "@playwright/test";
import { ONBOARDING_QUESTIONS } from "@zoonk/core/view-models/onboarding/contract";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { expect, test } from "./fixtures";
import { REPLAN_TIMEOUT_MS } from "./plan-timeouts";

const citation = { passage: "", sourceId: "notice" };

function noticeFixture(day: string) {
  return examBlueprintFixture({
    edition: {
      check: null,
      citations: [],
      dates: [{ citation, date: day, kind: "exam", label: "Exam", startTime: null }],
      noticeUrl: null,
      questionCount: null,
      sourceHash: null,
      timeZone: null,
      year: Number(day.slice(0, 4)),
    },
  });
}

function isoDaysFromNow(days: number): string {
  return new Date(Date.now() + days * MS_PER_DAY).toISOString().slice(0, 10);
}

function longDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  const otherYear = date.getUTCFullYear() !== new Date().getUTCFullYear();

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    ...(otherYear ? { year: "numeric" } : {}),
  }).format(date);
}

async function createTopic({ chapterId, position }: { chapterId: string; position: number }) {
  const [skill, lesson] = await Promise.all([
    skillFixture({ name: `Reading ${randomUUID()}` }),
    libraryLessonFixture({ estimatedMinutes: 3, homeChapterId: chapterId }),
  ]);

  await Promise.all([
    chapterLessonFixture({ chapterId, lessonId: lesson.id, position }),
    lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
  ]);

  return { area: null, lessons: 1, name: skill.name, phase: 0, skillId: skill.id, weight: null };
}

async function openExamPlan(
  browser: Browser,
  {
    blueprintId,
    details,
    targetDate,
  }: { blueprintId: string; details: Record<string, unknown>; targetDate: Date },
) {
  const [user, chapter] = await Promise.all([
    createE2EUser(getBaseURL()),
    libraryChapterFixture({ title: "Reading" }),
  ]);

  const [goal, skills] = await Promise.all([
    goalFixture({
      dailyMinutes: 30,
      details: {
        answered: [...ONBOARDING_QUESTIONS, "buddy", "placement"],
        examName: "ENEM",
        placementDeclined: true,
        ...details,
      },
      examBlueprintId: blueprintId,
      kind: "exam",
      targetDate,
      timezone: "UTC",
      title: "ENEM",
      userId: user.id,
    }),
    Promise.all([0, 1].map((position) => createTopic({ chapterId: chapter.id, position }))),
  ]);

  const [context, plan] = await Promise.all([
    browser.newContext({ storageState: user.storageState, timezoneId: "UTC" }),
    planFixture({
      goalId: goal.id,
      graph: { phases: [{ milestone: null, name: "Reading" }], skills },
    }),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
  ]);

  await planItemFixture({
    completedAt: new Date(),
    planId: plan.id,
    position: 0,
    skillId: skills[0]?.skillId ?? null,
    status: "testedOut",
    titleSnapshot: "Reading",
  });

  return { goal, page: await context.newPage() };
}

async function readTargetDate(goalId: string): Promise<string | null> {
  const goal = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });
  return goal.targetDate?.toISOString().slice(0, 10) ?? null;
}

test.describe("Exam date", () => {
  test("the plan editor changes the exam's full date any time, with the notice's day one tap away", async ({
    browser,
  }) => {
    const noticeDay = isoDaysFromNow(70);
    const ownDay = isoDaysFromNow(77);
    const laterDay = isoDaysFromNow(84);
    const blueprint = await noticeFixture(noticeDay);

    const { goal, page } = await openExamPlan(browser, {
      blueprintId: blueprint.id,
      details: { examYear: Number(noticeDay.slice(0, 4)) },
      targetDate: new Date(`${ownDay}T00:00:00Z`),
    });

    try {
      await page.goto("/plan");

      await page
        .getByRole("region", { exact: true, name: "Your plan" })
        .getByRole("button", { name: /^Exam date/u })
        .click();

      const editor = page.getByRole("dialog", { name: "Adjust your plan" });
      const date = editor.getByLabel("Exam date");
      const offerText = `The exam notice says ${longDate(noticeDay)}.`;
      const offer = editor.getByText(offerText, { exact: true });

      await expect(date).toHaveValue(ownDay);
      await expect(offer).toBeVisible();

      await editor.getByRole("button", { name: "Use this date" }).click();
      await expect(offer).toBeHidden({ timeout: REPLAN_TIMEOUT_MS });
      await expect(date).toHaveValue(noticeDay);
      await expect.poll(() => readTargetDate(goal.id)).toBe(noticeDay);

      await date.fill(laterDay);
      await editor.getByRole("button", { name: "Save" }).click();
      await expect(offer).toBeVisible({ timeout: REPLAN_TIMEOUT_MS });
      await expect(editor.getByRole("button", { name: "Save" })).toBeHidden();
      await expect.poll(() => readTargetDate(goal.id)).toBe(laterDay);
    } finally {
      await page.context().close();
    }
  });
});
