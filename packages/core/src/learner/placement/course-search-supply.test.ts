import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { recordPlacementPrepared } from "../../lookahead/placement-item-skills";
import { learnerGoalFixture } from "../_test-utils/learner-goal";
import { lowGuessTapItems } from "../_test-utils/placement-tap-items";
import { readPlacementAttempt } from "./_utils/placement-attempt-record";
import { getGoalPlacement } from "./get-goal-placement";
import { startPlacementSitting } from "./start-placement-sitting";

describe("preparing course placement", () => {
  it("freezes the first eligible bank only in its writer and ignores later supplies", async () => {
    const user = await userFixture();

    const { goal, plan, skills } = await learnerGoalFixture({
      itemsPerSkill: 0,
      phases: [8],
      userId: user.id,
    });

    mockSession(user.id);
    const goalId = goal.id;

    const read = async () =>
      readPlacementAttempt(await prisma.goal.findUniqueOrThrow({ where: { id: goalId } })).attempt
        ?.search;

    await expect(startPlacementSitting({ goalId, input: {} })).resolves.toMatchObject({
      placement: { next: null, status: "waitingForQuestions" },
    });

    await Promise.all(skills.map((skill) => lowGuessTapItems(skill.id)));

    await expect(getGoalPlacement({ goalId })).resolves.toMatchObject({
      placement: { next: null, status: "waitingForQuestions" },
    });

    await expect(read()).resolves.toMatchObject({ topics: null });
    await recordPlacementPrepared({ goalId, planRunId: plan.runId });
    const frozen = await read();
    expect(frozen?.topics?.length).toBe(8);

    await expect(getGoalPlacement({ goalId })).resolves.toMatchObject({
      placement: { answered: 0, status: "asking" },
    });

    await Promise.all(skills.map((skill) => lowGuessTapItems(skill.id)));
    await recordPlacementPrepared({ goalId, planRunId: plan.runId });
    await expect(read()).resolves.toStrictEqual(frozen);
  });

  it("retries an incomplete writer from the same explicit sitting", async () => {
    const user = await userFixture();

    const { goal, plan, skills } = await learnerGoalFixture({
      itemsPerSkill: 0,
      phases: [4],
      userId: user.id,
    });

    mockSession(user.id);
    const goalId = goal.id;
    const open = () => startPlacementSitting({ goalId, input: {} });
    const first = await open();

    if (first.status !== "ready" || !first.placement.attempt) {
      throw new Error("Expected a preparing sitting");
    }

    await recordPlacementPrepared({ goalId, planRunId: plan.runId });

    await expect(getGoalPlacement({ goalId })).resolves.toMatchObject({
      placement: { next: null, status: "failed" },
    });

    await expect(open()).resolves.toMatchObject({
      placement: { attempt: { id: first.placement.attempt.id }, status: "waitingForQuestions" },
    });

    await Promise.all(skills.map((skill) => lowGuessTapItems(skill.id)));
    await recordPlacementPrepared({ goalId, planRunId: plan.runId });

    await expect(getGoalPlacement({ goalId })).resolves.toMatchObject({
      placement: { attempt: { id: first.placement.attempt.id }, status: "asking" },
    });
  });
});
