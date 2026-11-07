import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { loadGoalPlan } from "../learner/_utils/goal-skill-graph";
import { markPlanItemsTestedOut } from "../learner/_utils/known-skills";
import { readPlan } from "./_test-utils/kept-end-plan";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { createGoalPlan } from "./create-goal-plan";
import { decidePlanChange } from "./decide-plan-change";

const NOW = new Date("2020-09-28T12:00:00Z");

describe("undoing a test-out shared across goals", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("restores the other goal's plan too", async () => {
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
    mockSession(user.id);

    const [sourceShown, otherShown] = await Promise.all([
      readPlan(source.plan.id),
      readPlan(other.plan.id),
    ]);

    const { items } = await loadGoalPlan(source.goal.id);

    const skipped = await markPlanItemsTestedOut({
      followToday: false,
      goalId: source.goal.id,
      items,
      knownSkillIds: new Set([library.skills[0]?.id ?? ""]),
      testedOutAt: new Date(),
      timeZone: "UTC",
    });

    // The test-out reached the other goal's plan...
    const otherAfter = await readPlan(other.plan.id);
    expect(otherAfter.items.some((item) => item.status === "testedOut")).toBe(true);

    await expect(
      decidePlanChange({
        changeId: skipped.changeId ?? "",
        goalId: source.goal.id,
        input: { status: "undone" },
      }),
    ).resolves.toMatchObject({ change: { status: "undone" }, status: "updated" });

    await expect(readPlan(source.plan.id)).resolves.toStrictEqual(sourceShown);

    // ...so undoing it must not leave those lessons skipped there.
    await expect(readPlan(other.plan.id)).resolves.toStrictEqual(otherShown);
  });
});
