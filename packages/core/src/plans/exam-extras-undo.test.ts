import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { AHEAD_START, readPlanScreen } from "./_test-utils/ahead-plan";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { createSetUpGoalPlan } from "./_test-utils/set-up-plan";
import { changeGoalPlan } from "./change-goal-plan";
import { decidePlanChange } from "./decide-plan-change";
import { addDays } from "./planner/plan-calendar";
import { parsePlanSettings } from "./planner/plan-state";

describe("undoing added exam strategy", () => {
  afterEach(() => vi.useRealTimers());

  it("takes its lessons out, forgets the choice and offers it again", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AHEAD_START);

    const [user, library] = await Promise.all([
      userFixture(),
      planLibraryFixture({
        skills: [
          { area: "Math", lessons: 1 },
          { area: "Exam strategy", lessons: 5 },
        ],
      }),
    ]);

    const [math, strategy] = library.graph.skills;

    const { goal, plan } = await unplannedGoalFixture({
      dailyMinutes: 40,
      details: { placementDeclined: true },
      kind: "exam",
      settings: { startDate: "2020-09-29" },
      targetDate: addDays(new Date("2020-09-29"), 6),
      timezone: "UTC",
      userId: user.id,
    });

    await createSetUpGoalPlan({
      goalId: goal.id,
      graph: {
        ...library.graph,
        extraSkills: [strategy!],
        skills: [{ ...math!, topics: ["Fractions"] }],
      },
    });

    mockSession(user.id);

    const countExtraItems = () =>
      prisma.planItem.count({
        where: { kind: "lesson", planId: plan.id, skillId: strategy!.skillId, status: "todo" },
      });

    const operations = [{ kind: "setExtras" as const, skillIds: [strategy!.skillId] }];
    const added = await changeGoalPlan({ goalId: goal.id, input: { operations } });
    const change = added.status === "applied" ? added.change : null;

    await expect(countExtraItems()).resolves.toBe(5);

    await expect(
      decidePlanChange({
        changeId: change?.id ?? "",
        goalId: goal.id,
        input: { status: "undone" },
      }),
    ).resolves.toMatchObject({ change: { status: "undone" }, status: "updated" });

    await expect(countExtraItems()).resolves.toBe(0);

    const undone = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    expect(parsePlanSettings(undone.settings).extras ?? []).toStrictEqual([]);

    await expect(readPlanScreen()).resolves.toMatchObject({
      extraOffer: { canApply: true, lessons: 5, operations },
    });
  });
});
