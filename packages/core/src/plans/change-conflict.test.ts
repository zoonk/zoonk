import { prisma } from "@zoonk/db";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import * as applyPlanChange from "./_utils/apply-plan-change";
import { changeGoalPlan } from "./change-goal-plan";
import { createGoalPlan } from "./create-goal-plan";
import { refreshGoalPlan } from "./refresh-goal-plan";

const SUNDAY = new Date("2020-09-27T12:00:00Z");

async function setup() {
  const user = await userFixture();

  const library = await planLibraryFixture({
    skills: [
      { lessons: 4, phase: 0 },
      { lessons: 0, phase: 0, size: 10 },
    ],
  });

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 12,
    settings: { startDate: "2020-09-27" },
    timezone: "UTC",
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });
  mockSession(user.id);

  const replanWithNewLesson = async () => {
    const lesson = await libraryLessonFixture({
      estimatedMinutes: 5,
      homeChapterId: library.chapters[0]?.id ?? "",
      title: `Outlined ${crypto.randomUUID()}`,
    });

    await Promise.all([
      chapterLessonFixture({
        chapterId: library.chapters[0]?.id ?? "",
        lessonId: lesson.id,
        position: 500 + Math.floor(Math.random() * 1000),
      }),
      lessonSkillFixture({ lessonId: lesson.id, skillId: library.graph.skills[1]?.skillId ?? "" }),
    ]);

    await refreshGoalPlan({ goalId: goal.id });
  };

  return { goal, plan, replanWithNewLesson };
}

describe("a learner's plan change while background re-plans keep landing", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SUNDAY);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("answers conflict and saves nothing when a re-plan lands before each try commits", async () => {
    const { goal, plan, replanWithNewLesson } = await setup();
    const apply = applyPlanChange.applyChangeNow;

    const raced = vi
      .spyOn(applyPlanChange, "applyChangeNow")
      .mockImplementation(async (request) => {
        await replanWithNewLesson();
        return apply(request);
      });

    const versionBefore = await prisma.plan.findUniqueOrThrow({
      select: { version: true },
      where: { id: plan.id },
    });

    const result = await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ kind: "setDailyMinutes", minutes: 30 }], timeZone: "UTC" },
    });

    expect(raced).toHaveBeenCalledTimes(2);
    expect(result).toStrictEqual({ status: "conflict" });

    const [after, kept] = await Promise.all([
      prisma.plan.findUniqueOrThrow({ select: { version: true }, where: { id: plan.id } }),
      prisma.goal.findUniqueOrThrow({ select: { dailyMinutes: true }, where: { id: goal.id } }),
    ]);

    expect(after.version).toBe(versionBefore.version + 2);
    expect(kept.dailyMinutes).toBe(12);

    await expect(
      prisma.planChange.count({ where: { kind: "edited", planId: plan.id } }),
    ).resolves.toBe(0);

    vi.mocked(applyPlanChange.applyChangeNow).mockRestore();

    await expect(
      changeGoalPlan({
        goalId: goal.id,
        input: { operations: [{ kind: "setDailyMinutes", minutes: 30 }], timeZone: "UTC" },
      }),
    ).resolves.toMatchObject({ status: "applied" });
  });
});
