import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { loadGoalPlan } from "../learner/_utils/goal-skill-graph";
import { markPlanItemsTestedOut } from "../learner/_utils/known-skills";
import { readPlan } from "./_test-utils/kept-end-plan";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { acknowledgeStoredNotice } from "./_utils/acknowledge-today-change";
import { loadPlanChangeView } from "./_utils/owned-plan";
import { createGoalPlan } from "./create-goal-plan";
import { decidePlanChange } from "./decide-plan-change";

const NOW = new Date("2020-09-28T12:00:00Z");

const HOUR = 60 * 60 * 1000;

async function setupPlan() {
  const user = await userFixture();

  const library = await planLibraryFixture({
    phases: ["Basics", "Next steps"],
    skills: [
      { area: "Math", lessons: 6 },
      { area: "Math", lessons: 6, phase: 1 },
    ],
  });

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 12,
    settings: { startDate: "2020-09-28" },
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });
  mockSession(user.id);

  return { goal, plan, skillIds: library.skills.map((skill) => skill.id), user };
}

async function skipSkill({ goalId, skillId }: { goalId: string; skillId: string }) {
  const { items } = await loadGoalPlan(goalId);

  return markPlanItemsTestedOut({
    followToday: false,
    goalId,
    items,
    knownSkillIds: new Set([skillId]),
    testedOutAt: new Date(),
    timeZone: "UTC",
  });
}

describe("lessons skipped one answer at a time", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the skips the learner hasn't seen as one change, which counts and undoes them all", async () => {
    const { goal, plan, skillIds } = await setupPlan();
    const shown = await readPlan(plan.id);

    const first = await skipSkill({ goalId: goal.id, skillId: skillIds[0] ?? "" });
    const second = await skipSkill({ goalId: goal.id, skillId: skillIds[1] ?? "" });

    expect(first.lessonsSkipped).toBeGreaterThan(0);
    expect(second.lessonsSkipped).toBeGreaterThan(0);

    const change = await loadPlanChangeView(first.changeId ?? "");

    expect(change.lessonsSkipped).toBe(first.lessonsSkipped + second.lessonsSkipped);
    expect(change).toMatchObject({ canUndo: true, kind: "testedOut" });
    expect(second.changeId).toBe(first.changeId);

    await expect(
      decidePlanChange({ changeId: change.id, goalId: goal.id, input: { status: "undone" } }),
    ).resolves.toMatchObject({ change: { status: "undone" }, status: "updated" });

    await expect(readPlan(plan.id)).resolves.toStrictEqual(shown);
  });

  it("starts a new change once the learner has seen the last skip", async () => {
    const { goal, skillIds, user } = await setupPlan();

    const first = await skipSkill({ goalId: goal.id, skillId: skillIds[0] ?? "" });
    await acknowledgeStoredNotice({ changeId: first.changeId ?? "", userId: user.id });
    const second = await skipSkill({ goalId: goal.id, skillId: skillIds[1] ?? "" });

    expect(second.changeId).not.toBe(first.changeId);

    await expect(loadPlanChangeView(second.changeId ?? "")).resolves.toMatchObject({
      lessonsSkipped: second.lessonsSkipped,
    });
  });

  it("counts lessons two announcements both name once", async () => {
    const { goal, skillIds } = await setupPlan();
    const { items } = await loadGoalPlan(goal.id);

    const skip = () =>
      markPlanItemsTestedOut({
        followToday: false,
        goalId: goal.id,
        items,
        knownSkillIds: new Set([skillIds[0] ?? ""]),
        testedOutAt: new Date(),
        timeZone: "UTC",
      });

    const first = await skip();
    const second = await skip();

    expect(second.changeId).toBe(first.changeId);

    await expect(loadPlanChangeView(first.changeId ?? "")).resolves.toMatchObject({
      lessonsSkipped: first.lessonsSkipped,
    });
  });

  it("starts a new change once the last skip is a day old", async () => {
    const { goal, skillIds } = await setupPlan();
    const first = await skipSkill({ goalId: goal.id, skillId: skillIds[0] ?? "" });

    await prisma.planChange.update({
      data: { createdAt: new Date(NOW.getTime() - 25 * HOUR) },
      where: { id: first.changeId ?? "" },
    });

    const second = await skipSkill({ goalId: goal.id, skillId: skillIds[1] ?? "" });

    expect(second.changeId).not.toBe(first.changeId);

    await expect(loadPlanChangeView(second.changeId ?? "")).resolves.toMatchObject({
      lessonsSkipped: second.lessonsSkipped,
    });
  });
});
