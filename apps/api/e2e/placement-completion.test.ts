import { expect, test } from "@zoonk/e2e/fixtures";
import { learnerGoalFixture } from "../../../packages/core/src/learner/_test-utils/learner-goal";
import { lowGuessTapItems } from "../../../packages/core/src/learner/_test-utils/placement-tap-items";
import {
  placementAnswerResponseSchema,
  placementCompletionResponseSchema,
  placementResponseSchema,
} from "../src/lib/openapi/schemas/learner";
import { planResponseSchema } from "../src/lib/openapi/schemas/plans";
import { createAuthenticatedApiContext } from "./helpers/auth";
import { readBody } from "./helpers/response";

test("a finished placement can be undone from Plan after the change is recorded", async () => {
  const { apiContext, user } = await createAuthenticatedApiContext({
    baseURL: process.env.E2E_BASE_URL ?? "",
    prefix: "placement-finish",
  });

  try {
    const { goal, skills } = await learnerGoalFixture({
      challengesDone: true,
      itemsPerSkill: 1,
      phases: [1],
      userId: user.id,
    });

    const [skill] = skills;

    if (!skill) {
      throw new Error("Expected a topic to confirm");
    }

    const taps = await lowGuessTapItems(skill.id);
    const answers = new Map(taps.map(({ item, answer }) => [item.id, answer] as const));
    const goalPath = `/v1/goals/${goal.id}`;
    const path = `${goalPath}/placement`;

    const opened = await readBody({
      response: await apiContext.post(`${path}/sittings`, { data: { length: "quick" } }),
      schema: placementResponseSchema,
    });

    const attemptId = opened.attempt?.id;

    if (!attemptId) {
      throw new Error("Expected an open placement test");
    }

    const answerNext = async (itemId: string | undefined): Promise<void> => {
      if (!itemId) {
        return;
      }

      const placed = await readBody({
        response: await apiContext.post(`${path}/answers`, {
          data: {
            answer: answers.get(itemId) ?? { selectedIndex: 0 },
            attemptId,
            durationMs: 1000,
            itemId,
          },
        }),
        schema: placementAnswerResponseSchema,
      });

      expect(placed.isCorrect).toBe(true);
      await answerNext(placed.placement.next?.itemId);
    };

    await answerNext(opened.next?.itemId);

    const finish = async () =>
      readBody({
        response: await apiContext.post(`${path}/completion`, { data: { attemptId, part: 1 } }),
        schema: placementCompletionResponseSchema,
      });

    await expect(finish()).resolves.toMatchObject({ lessonsSkipped: 1 });

    const plan = async () =>
      readBody({ response: await apiContext.get(`${goalPath}/plan`), schema: planResponseSchema });

    const currentUndo = async () => {
      const { changes } = await plan();
      return changes.find(({ canUndo, kind }) => canUndo && kind === "testedOut")?.id;
    };

    await expect.poll(currentUndo).toEqual(expect.any(String));
    const changeId = await currentUndo();

    await expect(finish()).resolves.toMatchObject({ changeId, lessonsSkipped: 1 });

    const undone = await apiContext.post(`${goalPath}/plan/changes/${changeId}`, {
      data: { status: "undone" },
    });

    expect(undone.status()).toBe(200);

    await expect(plan()).resolves.toMatchObject({
      placementTest: { result: { lessonsSkipped: 0 } },
    });
  } finally {
    await apiContext.dispose();
  }
});
