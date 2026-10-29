import { prisma } from "@zoonk/db";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { replanWaitingGoal } from "../library/curriculum/replan-waiting-goals";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { changeGoalPlan } from "./change-goal-plan";
import { createGoalPlan } from "./create-goal-plan";
import { decidePlanChange } from "./decide-plan-change";
import { getGoalPlan } from "./get-goal-plan";

const NOW = new Date("2020-09-28T12:00:00Z");

async function behindPlanFixture(kind: "exam" | "learn") {
  const [user, library] = await Promise.all([
    userFixture(),
    planLibraryFixture({ skills: [{ lessons: 0, size: 4 }, { lessons: 8 }] }),
  ]);

  const { goal, plan } = await unplannedGoalFixture({
    createdAt: NOW,
    dailyMinutes: 45,
    kind,
    settings: { startDate: "2020-09-28" },
    targetDate: new Date("2020-10-26"),
    timezone: "UTC",
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });
  mockSession(user.id);

  const previous = await studySessionFixture({
    goalId: goal.id,
    localDate: new Date("2020-09-27"),
    userId: user.id,
  });

  const pending = await prisma.planItem.findMany({
    orderBy: { position: "asc" },
    take: 3,
    where: {
      kind: "lesson",
      lessonId: { in: library.lessons.slice(1).map((lesson) => lesson.id) },
      planId: plan.id,
    },
  });

  await Promise.all([
    prisma.planItem.updateMany({
      data: { scheduledFor: new Date("2020-09-27") },
      where: { lessonId: library.lessons[0]?.id, planId: plan.id },
    }),
    prisma.planItem.updateMany({
      data: { scheduledFor: new Date("2020-09-29") },
      where: { id: { in: pending.map((item) => item.id) } },
    }),
    ...pending.map((item, position) =>
      studySessionBlockFixture({ lessonId: item.lessonId, position, sessionId: previous.id }),
    ),
  ]);

  const writtenSchedule = () =>
    prisma.planItem.findMany({
      orderBy: { id: "asc" },
      select: { id: true, scheduledFor: true, status: true },
      where: { lessonId: { in: library.lessons.map((lesson) => lesson.id) }, planId: plan.id },
    });

  return { goal, library, plan, writtenSchedule };
}

async function writeLessons(skillId: string) {
  return Promise.all(
    Array.from({ length: 4 }, async () => {
      const lesson = await libraryLessonFixture({ estimatedMinutes: 3 });
      await lessonSkillFixture({ lessonId: lesson.id, skillId });
      return lesson.id;
    }),
  );
}

describe("Undo after lesson preparation", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => vi.useRealTimers());

  it.each([
    { kind: "learn", setBack: false },
    { kind: "exam", setBack: false },
    { kind: "exam", setBack: true },
  ] as const)(
    "restores the $kind plan's catch-up and dates (setBack: $setBack)",
    async ({ kind, setBack }) => {
      const { goal, library, plan, writtenSchedule } = await behindPlanFixture(kind);
      const before = await writtenSchedule();

      await expect(getGoalPlan(goal.id)).resolves.toMatchObject({
        plan: { status: { kind: "behind", lessons: 1 } },
      });

      const changed = await changeGoalPlan({
        goalId: goal.id,
        input: { operations: [{ kind: "setDailyMinutes", minutes: 60 }] },
      });

      if (changed.status !== "applied" || !changed.change) {
        throw new Error("Expected an undoable daily-time change");
      }

      const lessonIds = await writeLessons(library.skills[0]?.id ?? "");
      await replanWaitingGoal(goal.id);

      await expect(
        prisma.planChange.findUniqueOrThrow({ where: { id: changed.change.id } }),
      ).resolves.toMatchObject({ payload: { replannedSince: true } });

      const undone = setBack
        ? await changeGoalPlan({
            goalId: goal.id,
            input: { operations: [{ kind: "setDailyMinutes", minutes: 45 }] },
          })
        : await decidePlanChange({
            changeId: changed.change.id,
            goalId: goal.id,
            input: { status: "undone" },
          });

      expect(undone).toMatchObject({
        change: { id: changed.change.id, status: "undone" },
        status: setBack ? "applied" : "updated",
      });

      await expect(getGoalPlan(goal.id)).resolves.toMatchObject({
        plan: { status: { kind: "behind", lessons: 1 } },
      });

      await expect(writtenSchedule()).resolves.toStrictEqual(before);

      await expect(
        prisma.goal.findUniqueOrThrow({ where: { id: goal.id } }),
      ).resolves.toMatchObject({ dailyMinutes: 45 });

      await expect(
        prisma.planItem.count({ where: { lessonId: { in: lessonIds }, planId: plan.id } }),
      ).resolves.toBe(4);

      await replanWaitingGoal(goal.id);

      await expect(getGoalPlan(goal.id)).resolves.toMatchObject({
        plan: { status: { kind: "behind", lessons: 1 } },
      });

      await expect(writtenSchedule()).resolves.toStrictEqual(before);

      await expect(
        prisma.planChange.count({ where: { kind: "missedDays", planId: plan.id } }),
      ).resolves.toBe(0);
    },
  );
});
