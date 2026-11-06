import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { takenChallengeFixture } from "./_test-utils/taken-challenge";
import { createGoalPlan } from "./create-goal-plan";
import { refreshGoalPlan } from "./refresh-goal-plan";

const DAY = 86_400_000;

/** A Sunday in 2020, before the learning events other tests write, which estimates read. */
const SUNDAY = new Date("2020-09-27T12:00:00Z");

async function setup({ dailyMinutes, lessons }: { dailyMinutes: number; lessons: number[] }) {
  const user = await userFixture();

  const library = await planLibraryFixture({
    phases: lessons.map((_, phase) => `Phase ${phase + 1}`),
    skills: lessons.map((count, phase) => ({ lessons: count, phase })),
  });

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes,
    settings: { startDate: "2020-09-27" },
    targetDate: new Date("2020-12-31T00:00:00Z"),
    timezone: "UTC",
    userId: user.id,
  });

  await takenChallengeFixture({ date: new Date("2020-09-20T00:00:00Z"), planId: plan.id });
  await createGoalPlan({ goalId: goal.id, graph: library.graph });
  mockSession(user.id);

  return { goal, library, plan };
}

async function comeBack({ days, goalId }: { days: number; goalId: string }) {
  vi.setSystemTime(new Date(SUNDAY.getTime() + days * DAY));
  await refreshGoalPlan({ goalId });
}

describe("a phase's challenge after missed days", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SUNDAY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("comes after the lessons it tests, moving the later phase ends it would pass", async () => {
    const { goal, library, plan } = await setup({ dailyMinutes: 24, lessons: [3, 3, 3, 3, 3] });

    await comeBack({ days: 2, goalId: goal.id });

    const phaseOf = new Map(library.graph.skills.map((skill) => [skill.skillId, skill.phase]));
    const items = await prisma.planItem.findMany({ where: { planId: plan.id, status: "todo" } });

    const lessonsAfter = items
      .filter((boss) => boss.kind === "boss" && boss.phase < library.graph.phases.length - 1)
      .flatMap((boss) =>
        items.filter(
          (item) =>
            item.kind === "lesson" &&
            phaseOf.get(item.skillId ?? "") === boss.phase &&
            item.scheduledFor !== null &&
            boss.scheduledFor !== null &&
            item.scheduledFor > boss.scheduledFor,
        ),
      );

    expect(lessonsAfter).toStrictEqual([]);
  });
});
