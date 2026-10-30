import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getTodayView } from "../view-models/today/get-today-view";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { changeGoalPlan } from "./change-goal-plan";
import { createGoalPlan } from "./create-goal-plan";
import { LEARN_KINDS } from "./planner/plan-item-rules";

/** A Monday in 2020, before other tests' learning events, so pace estimates don't move dates. */
const NOW = new Date("2020-09-28T12:00:00Z");

async function placedLearner() {
  const user = await userFixture();

  const library = await planLibraryFixture({
    phases: ["Basics", "Known", "Later"],
    skills: [
      { lessons: 4, phase: 0 },
      { lessons: 2, phase: 1, size: 20 },
      { lessons: 0, phase: 2, size: 20 },
    ],
  });

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 60,
    settings: { startDate: "2020-09-28" },
    targetDate: new Date("2020-10-02T00:00:00Z"),
    timezone: "UTC",
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });
  mockSession(user.id);

  const known = library.skills[1];

  await prisma.planItem.updateMany({
    data: { completedAt: NOW, scheduledFor: new Date("2020-09-28T00:00:00Z"), status: "testedOut" },
    where: { lessonId: { not: null }, planId: plan.id, skillId: known?.id },
  });

  return { goal, plan };
}

async function readItems(planId: string) {
  return prisma.planItem.findMany({ orderBy: { position: "asc" }, where: { planId } });
}

describe("a placed learner's phase challenges", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("keeps a challenge only for a phase with something to study, and after its lessons", async () => {
    const { goal, plan } = await placedLearner();

    await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ kind: "setDailyMinutes", minutes: 5 }], timeZone: "UTC" },
    });

    const items = await readItems(plan.id);

    const studied = (phase: number) =>
      items.filter(
        (item) => LEARN_KINDS.has(item.kind) && item.phase === phase && item.status !== "testedOut",
      );

    const bosses = items.filter((item) => item.kind === "boss" && item.status === "todo");

    expect(bosses.map((boss) => boss.phase).toSorted((a, b) => a - b)).toStrictEqual(
      [0, 1, 2].filter((phase) => studied(phase).length > 0),
    );

    const today = await getTodayView({ goalId: goal.id, timeZone: "UTC" });

    if (today.status !== "ready") {
      throw new Error(`Expected Today, got ${today.status}`);
    }

    expect(today.today.session.blocks.map((block) => block.kind)).not.toContain("checkpoint");

    for (const boss of bosses) {
      const last = studied(boss.phase).at(-1)?.scheduledFor?.getTime() ?? 0;
      expect(boss.scheduledFor?.getTime() ?? 0).toBeGreaterThanOrEqual(last);
    }
  });
});
