import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { lockPlanInputWrite, writePlanInputs } from "./plan-input-write";

async function dependentPlan(attrs: Omit<Parameters<typeof planFixture>[0], "goalId"> = {}) {
  const user = await userFixture();
  const goal = await goalFixture({ userId: user.id });
  return planFixture({ ...attrs, goalId: goal.id });
}

function readPlans(planIds: readonly string[]) {
  return Promise.all(
    planIds.map((id) =>
      prisma.plan.findUniqueOrThrow({ select: { inputVersion: true }, where: { id } }),
    ),
  );
}

describe(lockPlanInputWrite, () => {
  it("marks every dependent plan changed, and no other", async () => {
    const [first, second, unrelated] = await Promise.all([
      dependentPlan(),
      dependentPlan(),
      dependentPlan(),
    ]);

    await writePlanInputs((tx) =>
      lockPlanInputWrite({
        loadPlanIds: async () => [first.id, second.id],
        lockSources: async () => {},
        tx,
      }),
    );

    await expect(readPlans([first.id, second.id, unrelated.id])).resolves.toStrictEqual([
      { inputVersion: first.inputVersion + 1 },
      { inputVersion: second.inputVersion + 1 },
      { inputVersion: unrelated.inputVersion },
    ]);
  });

  it("rolls the first marks back when a dependent appears while sources lock, then marks the whole union once", async () => {
    const [first, joined] = await Promise.all([dependentPlan(), dependentPlan()]);
    let loads = 0;

    await writePlanInputs((tx) =>
      lockPlanInputWrite({
        // The first attempt's recheck finds a plan that started depending on the source meanwhile.
        loadPlanIds: async () => {
          loads += 1;
          return loads === 1 ? [first.id] : [first.id, joined.id];
        },
        lockSources: async () => {},
        tx,
      }),
    );

    expect(loads).toBe(4);

    await expect(readPlans([first.id, joined.id])).resolves.toStrictEqual([
      { inputVersion: first.inputVersion + 1 },
      { inputVersion: joined.inputVersion + 1 },
    ]);
  });
});
