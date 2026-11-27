import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { decidePlanChange } from "../../plans/decide-plan-change";
import { getGoalPlan } from "../../plans/get-goal-plan";
import { learnerGoalFixture } from "../_test-utils/learner-goal";
import { placementItemBank } from "../_test-utils/placement-tap-items";
import { answerPlacementQuestion } from "./answer-placement-question";
import { finishGoalPlacement } from "./finish-goal-placement";
import { startPlacementSitting } from "./start-placement-sitting";

describe(finishGoalPlacement, () => {
  it("accepts a new provisional start on fresh questions after Undo", async () => {
    const user = await userFixture();

    const { goal, skills } = await learnerGoalFixture({
      itemsPerSkill: 0,
      phases: [2],
      userId: user.id,
    });

    const [skill] = skills;

    if (!skill) {
      throw new Error("Expected one test topic");
    }

    const banks = await placementItemBank([...skills, ...skills].map((topic) => topic.id));
    const answers = new Map(banks.flat().map(({ answer, item }) => [item.id, answer]));
    mockSession(user.id);

    const takeTest = async () => {
      const start = await startPlacementSitting({ goalId: goal.id, input: { length: "quick" } });

      if (start.status !== "ready" || !start.placement.attempt || !start.placement.next) {
        throw new Error("Expected a Quick question");
      }

      const { id: attemptId } = start.placement.attempt;

      const send = async (itemId: string, remaining: number): Promise<void> => {
        const answer = answers.get(itemId);

        if (!answer) {
          throw new Error("Expected an answer to the next question");
        }

        const result = await answerPlacementQuestion({
          goalId: goal.id,
          input: { answer, attemptId, durationMs: 100, itemId },
        });

        expect(result).toMatchObject({ isCorrect: true, status: "ready" });

        if (remaining > 1 && result.status === "ready" && result.placement.next) {
          await send(result.placement.next.itemId, remaining - 1);
          return;
        }

        expect(result.status === "ready" && result.placement.next).toBeNull();
      };

      await send(start.placement.next.itemId, 4);
      const finish = () => finishGoalPlacement({ goalId: goal.id, input: { attemptId } });
      return { finish, result: await finish() };
    };

    const first = await takeTest();

    if (first.result.status !== "ready" || !first.result.completion.changeId) {
      throw new Error("Expected a skip that can be undone");
    }

    const { changeId } = first.result.completion;

    await expect(
      decidePlanChange({ changeId, goalId: goal.id, input: { status: "undone" } }),
    ).resolves.toMatchObject({ status: "updated" });

    const retake = await takeTest();
    const held = { lessonsSkipped: 1 };
    expect(retake.result).toMatchObject({ completion: { ...held, result: held }, status: "ready" });
    await expect(retake.finish()).resolves.toStrictEqual(retake.result);

    await expect(getGoalPlan(goal.id)).resolves.toMatchObject({
      plan: { placementTest: { result: held } },
    });
  });
});
