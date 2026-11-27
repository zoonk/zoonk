import { prisma } from "@zoonk/db";
import { itemFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { recordPlacementPrepared } from "../../lookahead/placement-item-skills";
import { learnerGoalFixture } from "../_test-utils/learner-goal";
import { finishGoalPlacement } from "./finish-goal-placement";
import { getGoalPlacement } from "./get-goal-placement";
import { startPlacementSitting } from "./start-placement-sitting";

describe("Whole-course question preparation", () => {
  it.each(["quick", "wholeCourse"] as const)(
    "keeps an empty %s part open when its writer fails and retries the same part",
    async (length) => {
      const user = await userFixture();

      const { goal, skills } = await learnerGoalFixture({
        itemsPerSkill: 0,
        phases: [1],
        userId: user.id,
      });

      const [skill] = skills;

      if (!skill) {
        throw new Error("Expected a topic to write questions for");
      }

      mockSession(user.id);

      const start = () => startPlacementSitting({ goalId: goal.id, input: { length } });

      const read = () => getGoalPlacement({ goalId: goal.id });
      const opened = await start();

      if (opened.status !== "ready" || !opened.placement.attempt) {
        throw new Error("Expected an open Whole-course attempt");
      }

      const { id: attemptId } = opened.placement.attempt;

      const outcome = {
        failed: true,
        goalId: goal.id,
        placementPart: { attemptId, part: 1 },
        planRunId: null,
      };

      await recordPlacementPrepared(outcome);

      await expect(prisma.goal.findUnique({ where: { id: goal.id } })).resolves.toMatchObject({
        details: {
          placementTest: { attempt: { partPreparationFailed: true, partPrepared: false } },
        },
      });

      await expect(read()).resolves.toMatchObject({
        placement: { answered: 0, next: null, result: null, status: "failed" },
      });

      await expect(
        finishGoalPlacement({ goalId: goal.id, input: { attemptId, part: 1 } }),
      ).resolves.toStrictEqual({ status: "staleAttempt" });

      const attempt = { id: attemptId, part: 1, partComplete: false };

      await expect(start()).resolves.toMatchObject({
        placement: { attempt, status: "waitingForQuestions" },
      });

      await expect(start()).resolves.toMatchObject({
        placement: { attempt, status: "waitingForQuestions" },
      });

      await expect(
        prisma.followUp.findMany({ where: { kind: "preparePlacementItems", userId: user.id } }),
      ).resolves.toMatchObject([{ revision: 1 }]);

      await recordPlacementPrepared(outcome);

      await expect(read()).resolves.toMatchObject({
        placement: { attempt, status: "waitingForQuestions" },
      });

      const item = await itemFixture({ skillId: skill.id });

      await expect(read()).resolves.toMatchObject({
        placement: { attempt, next: { itemId: item.id }, status: "asking" },
      });
    },
  );

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
