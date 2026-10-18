import { prisma } from "@zoonk/db";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { freezeClock } from "../../_test-utils/frozen-clock";
import { mockSession } from "../../_test-utils/mock-session";
import { planLibraryFixture, unplannedGoalFixture } from "../../plans/_test-utils/plan-library";
import { isPlanSetupTaskOwed } from "../../plans/_utils/plan-setup-tasks";
import * as announcement from "../../plans/announce-tested-out-items";
import { createGoalPlan } from "../../plans/create-goal-plan";
import { runPlanSetupTask } from "../../plans/plan-setup";
import * as knownSkills from "./known-skills";

const TODAY = "2020-09-28";

/**
 * A learner who ended placement before their plan existed, with a right answer that settles its
 * first skill (two lessons), and the new plan that owes placement. Monday, September 28, 2020.
 */
async function placedGoal() {
  freezeClock();
  vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`));

  const user = await userFixture();
  const library = await planLibraryFixture({ skills: [{ lessons: 2 }, { lessons: 1 }] });

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 12,
    details: { answered: ["level", "placement"], level: "intermediate" },
    settings: { startDate: TODAY },
    userId: user.id,
  });

  await Promise.all(
    (["beginner", "intermediate"] as const).map((level, index) =>
      prisma.skill.update({ data: { level }, where: { id: library.skills[index]?.id } }),
    ),
  );

  const skillId = library.skills[0]?.id ?? "";
  const item = await itemFixture({ content: choiceItemContent(), skillId });
  await attemptFixture({ isCorrect: true, itemId: item.id, skillId, userId: user.id });

  mockSession(user.id);
  await createGoalPlan({ goalId: goal.id, graph: library.graph, setup: "steps" });

  return { goalId: goal.id, planId: plan.id };
}

/** Holds the next `count` placements once each has read the plan, until all of them have. */
function holdPlacementReads(count: number) {
  const markKnown = knownSkills.markSkillsKnown;
  const reached = Promise.withResolvers<null>();
  let waiting = 0;

  const reads = vi.spyOn(knownSkills, "markSkillsKnown").mockImplementation(async (input) => {
    waiting += 1;

    if (waiting === count) {
      reads.mockRestore();
      reached.resolve(null);
    }

    await reached.promise;
    return markKnown(input);
  });

  return reached.promise;
}

/** Holds the next announcement of skipped lessons until `release`; it then runs. */
function holdNextAnnouncement() {
  const announce = announcement.announceTestedOutItems;
  const released = Promise.withResolvers<null>();

  const held = vi
    .spyOn(announcement, "announceTestedOutItems")
    .mockImplementationOnce(async (input) => {
      await released.promise;
      return announce(input);
    });

  return () => {
    released.resolve(null);
    held.mockRestore();
  };
}

describe("test-outs from the same read of the plan", () => {
  // Two runs of a new plan's placement read it before either tested its lessons out. The one that
  // lost the test-out ended the task without announcing, which rolled back the winner's
  // announcement: the lessons were skipped with no note and no undo.
  it("announce a new plan's placement once, with the task's end", async () => {
    const { goalId, planId } = await placedGoal();
    const run = () => runPlanSetupTask({ goalId, task: "placement" });
    const read = holdPlacementReads(2);
    const release = holdNextAnnouncement();

    try {
      const both = Promise.all([run(), run()]);
      await read;

      // The first to announce waits until the other has ended the task.
      await vi.waitFor(async () => {
        await expect(isPlanSetupTaskOwed({ goalId, task: "placement" })).resolves.toBe(false);
      });

      release();
      await both;
    } finally {
      release();
    }

    const [testedOut, announced] = await Promise.all([
      prisma.planItem.findMany({ select: { id: true }, where: { planId, status: "testedOut" } }),
      prisma.planChange.findMany({ where: { kind: "testedOut", planId } }),
    ]);

    expect(testedOut).toHaveLength(2);
    expect(announced).toHaveLength(1);

    expect(announced[0]?.payload).toMatchObject({
      planItemIds: expect.arrayContaining(testedOut.map((item) => item.id)),
    });
  });
});
