import { prisma } from "@zoonk/db";
import { itemFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { recordPlacementPrepared } from "../../lookahead/placement-item-skills";
import { learnerGoalFixture } from "../_test-utils/learner-goal";
import { finishGoalPlacement } from "./finish-goal-placement";
import { startPlacementSitting } from "./start-placement-sitting";

describe("Whole-course question preparation", () => {
  it("prepares two parts and advances the preparation window only on the next start", async () => {
    const user = await userFixture();

    const { goal, skills } = await learnerGoalFixture({
      itemsPerSkill: 0,
      phases: [26],
      userId: user.id,
    });

    const skillIds = skills.map(({ id }) => id);
    const laterSkill = skills[10];

    if (!laterSkill) {
      throw new Error("Expected a topic in the second part");
    }

    const laterItem = await itemFixture({ skillId: laterSkill.id });

    mockSession(user.id);

    const start = () =>
      startPlacementSitting({ goalId: goal.id, input: { length: "wholeCourse" } });

    const opened = await start();

    if (opened.status !== "ready" || !opened.placement.attempt) {
      throw new Error("Expected an open Whole-course attempt");
    }

    expect(opened.placement).toMatchObject({ next: null, status: "waitingForQuestions" });

    const { id: attemptId } = opened.placement.attempt;

    const owed = () =>
      prisma.followUp.findMany({ where: { kind: "preparePlacementItems", userId: user.id } });

    await expect(owed()).resolves.toMatchObject([
      { input: { skillIds: skillIds.slice(0, 20) }, revision: 0 },
    ]);

    await recordPlacementPrepared({
      goalId: goal.id,
      placementPart: { attemptId, part: 1 },
      planRunId: null,
    });

    await expect(
      finishGoalPlacement({ goalId: goal.id, input: { attemptId } }),
    ).resolves.toMatchObject({ completion: { attempt: { id: attemptId, partComplete: true } } });

    await expect(owed()).resolves.toMatchObject([{ revision: 0 }]);

    await expect(start()).resolves.toMatchObject({
      placement: { attempt: { id: attemptId, part: 2 }, next: { itemId: laterItem.id } },
    });

    await expect(owed()).resolves.toMatchObject([
      { input: { skillIds: skillIds.slice(10) }, revision: 1 },
    ]);

    await recordPlacementPrepared({
      goalId: goal.id,
      placementPart: { attemptId, part: 1 },
      planRunId: null,
    });

    await expect(prisma.goal.findUnique({ where: { id: goal.id } })).resolves.toMatchObject({
      details: { placementTest: { attempt: { part: 2, partPrepared: false } } },
    });

    await start();
    await expect(owed()).resolves.toMatchObject([{ revision: 1 }]);
  });
});
