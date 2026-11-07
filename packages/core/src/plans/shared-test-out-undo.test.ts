import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { holdLearnerLock, waitForBlockedStatement } from "../_test-utils/learner-lock";
import { mockSession } from "../_test-utils/mock-session";
import { loadGoalPlan } from "../learner/_utils/goal-skill-graph";
import { markPlanItemsTestedOut, markSkillsKnown } from "../learner/_utils/known-skills";
import { NEW_SKILL_MEMORY } from "../learner/fsrs-scheduler";
import { readPlan } from "./_test-utils/kept-end-plan";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { createGoalPlan } from "./create-goal-plan";
import { decidePlanChange } from "./decide-plan-change";

const NOW = new Date("2020-09-28T12:00:00Z");

async function setup(status: "active" | "paused" = "active") {
  const user = await userFixture();

  const library = await planLibraryFixture({
    phases: ["Basics", "Next steps"],
    skills: [
      { area: "Math", lessons: 6 },
      { area: "Math", lessons: 6, phase: 1 },
    ],
  });

  const [source, other] = await Promise.all([
    unplannedGoalFixture({
      dailyMinutes: 12,
      settings: { startDate: "2020-09-28" },
      userId: user.id,
    }),
    unplannedGoalFixture({
      dailyMinutes: 12,
      settings: { startDate: "2020-09-28" },
      userId: user.id,
    }),
  ]);

  await createGoalPlan({ goalId: source.goal.id, graph: library.graph });
  await createGoalPlan({ goalId: other.goal.id, graph: library.graph });
  await prisma.goal.update({ data: { status }, where: { id: other.goal.id } });
  mockSession(user.id);

  const [sourceShown, otherShown] = await Promise.all([
    readPlan(source.plan.id),
    readPlan(other.plan.id),
  ]);

  const { items } = await loadGoalPlan(source.goal.id);
  const skillId = library.skills[0]?.id ?? "";

  await markSkillsKnown({ knownAt: NOW, skillIds: [skillId], timeZone: "UTC", userId: user.id });

  const memory = () =>
    prisma.learnerSkill.findUniqueOrThrow({ where: { userSkill: { skillId, userId: user.id } } });

  const known = await memory();

  const skipped = await markPlanItemsTestedOut({
    followToday: false,
    goalId: source.goal.id,
    items,
    knownSkillIds: new Set([skillId]),
    testedOutAt: new Date(),
    timeZone: "UTC",
  });

  const otherAfter = await readPlan(other.plan.id);

  const otherChange = await prisma.planChange.findFirstOrThrow({
    where: { kind: "testedOut", planId: other.plan.id, status: "applied" },
  });

  return {
    known,
    memory,
    otherAfter,
    otherShown,
    readOther: () => readPlan(other.plan.id),
    readSource: () => readPlan(source.plan.id),
    sourceShown,
    undoOther: () =>
      decidePlanChange({
        changeId: otherChange.id,
        goalId: other.goal.id,
        input: { status: "undone" },
      }),
    undoSource: () =>
      decidePlanChange({
        changeId: skipped.changeId ?? "",
        goalId: source.goal.id,
        input: { status: "undone" },
      }),
    user,
  };
}

describe("undoing a test-out shared across goals", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(["active", "paused"] as const)(
    "gives the %s other goal its own undo and retains its assumed skills until then",
    async (status) => {
      const fixture = await setup(status);
      expect(fixture.otherAfter.items.some((item) => item.status === "testedOut")).toBe(true);

      await expect(fixture.undoSource()).resolves.toMatchObject({
        change: { status: "undone" },
        status: "updated",
      });

      await expect(fixture.readSource()).resolves.toStrictEqual(fixture.sourceShown);
      await expect(fixture.readOther()).resolves.toStrictEqual(fixture.otherAfter);
      await expect(fixture.memory()).resolves.toStrictEqual(fixture.known);

      await expect(fixture.undoOther()).resolves.toMatchObject({
        change: { status: "undone" },
        status: "updated",
      });

      await expect(fixture.readOther()).resolves.toStrictEqual(fixture.otherShown);
      await expect(fixture.memory()).resolves.toMatchObject(NEW_SKILL_MEMORY);
    },
  );

  it("clears the last assumption when both goals undo concurrently", async () => {
    const fixture = await setup();
    const holder = holdLearnerLock({ userId: fixture.user.id });
    const pid = await holder.pid;
    const undos = Promise.all([fixture.undoSource(), fixture.undoOther()]);

    try {
      await waitForBlockedStatement(pid, /FROM users/u, 2);
    } finally {
      holder.release();
      await Promise.all([holder.done, undos]);
    }

    await expect(undos).resolves.toMatchObject([
      { change: { status: "undone" }, status: "updated" },
      { change: { status: "undone" }, status: "updated" },
    ]);

    await expect(fixture.readSource()).resolves.toStrictEqual(fixture.sourceShown);
    await expect(fixture.readOther()).resolves.toStrictEqual(fixture.otherShown);
    await expect(fixture.memory()).resolves.toMatchObject(NEW_SKILL_MEMORY);
  });
});
