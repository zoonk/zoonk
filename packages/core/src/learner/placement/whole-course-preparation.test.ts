import { prisma } from "@zoonk/db";
import { itemFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { runDeferredWork } from "../../_test-utils/deferred-work";
import { mockSession } from "../../_test-utils/mock-session";
import { analytics } from "../../_test-utils/test-boundaries";
import { recordPlacementPrepared } from "../../lookahead/placement-item-skills";
import { learnerGoalFixture } from "../_test-utils/learner-goal";
import { placementItemBank } from "../_test-utils/placement-tap-items";
import { answerPlacementQuestion } from "./answer-placement-question";
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
      const flush = runDeferredWork();
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

      await flush();

      expect(
        analytics.trackServerEvent.mock.calls
          .flat()
          .filter((event) => event.name === "Test Started"),
      ).toMatchObject([{ properties: { attempt_id: attemptId, part: 1, resumed: false } }]);

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

  it("passes over a topic without questions and opens the next part when the material runs out", async () => {
    const user = await userFixture();

    const { goal, skills } = await learnerGoalFixture({
      itemsPerSkill: 0,
      phases: [6],
      userId: user.id,
    });

    const bank = await placementItemBank(skills.filter((_, i) => i !== 1).map(({ id }) => id));
    const answers = new Map(bank.flat().map(({ item, answer }) => [item.id, answer]));
    mockSession(user.id);
    const start = () => startPlacementSitting({ goalId: goal.id, input: { length: "quick" } });
    const opened = await start();

    if (opened.status !== "ready" || !opened.placement.attempt) {
      throw new Error("Expected an open attempt");
    }

    const { id: attemptId } = opened.placement.attempt;

    await recordPlacementPrepared({
      failed: false,
      goalId: goal.id,
      placementPart: { attemptId, part: 1 },
      planRunId: null,
    });

    let placement = opened.placement;

    for (let i = 0; i < 8; i += 1) {
      const itemId = placement.next?.itemId;
      const answer = itemId && answers.get(itemId);

      if (!answer || !itemId) {
        throw new Error(`Expected question ${i + 1}, got ${placement.status}`);
      }
      // oxlint-disable-next-line no-await-in-loop -- The next question depends on this answer.
      const result = await answerPlacementQuestion({
        goalId: goal.id,
        input: { answer, attemptId, durationMs: 90_000, itemId, part: 1 },
      });

      if (result.status !== "ready") {
        throw new Error("Expected the saved answer");
      }

      placement = result.placement;
    }

    await expect(
      finishGoalPlacement({ goalId: goal.id, input: { attemptId, part: 1 } }),
    ).resolves.toMatchObject({ completion: { finish: { end: "material_exhausted" } } });

    await expect(start()).resolves.toMatchObject({ placement: { attempt: { part: 2 } } });
  });

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
