import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { learnerGoalFixture } from "../_test-utils/learner-goal";
import { finishGoalPlacement } from "./finish-goal-placement";
import { startPlacementSitting } from "./start-placement-sitting";

describe("Whole-course question preparation", () => {
  it("does not advance a part whose writer has not delivered questions", async () => {
    const user = await userFixture();

    const { goal, skills } = await learnerGoalFixture({
      itemsPerSkill: 0,
      phases: [7],
      userId: user.id,
    });

    mockSession(user.id);

    const open = () => startPlacementSitting({ goalId: goal.id, input: { length: "wholeCourse" } });
    const opened = await open();

    if (opened.status !== "ready" || !opened.placement.attempt) {
      throw new Error("Expected an open whole-course attempt");
    }

    const { id: attemptId } = opened.placement.attempt;

    expect(opened.placement).toMatchObject({
      attempt: { part: 1, parts: 3, questions: 12 },
      next: null,
      status: "waitingForQuestions",
    });

    await expect(
      prisma.followUp.findMany({ where: { kind: "preparePlacementItems", userId: user.id } }),
    ).resolves.toMatchObject([
      { input: { skillIds: skills.slice(0, 3).map(({ id }) => id) }, revision: 0 },
    ]);

    await expect(
      finishGoalPlacement({ goalId: goal.id, input: { attemptId } }),
    ).resolves.toMatchObject({
      completion: {
        attempt: { id: attemptId, part: 1, partComplete: false, resume: { part: 1, question: 1 } },
        finish: { answered: 0, end: "stopped", partsLeft: 3 },
      },
    });

    await expect(open()).resolves.toMatchObject({
      placement: { attempt: { id: attemptId, part: 1 }, status: "waitingForQuestions" },
    });
  });
});
