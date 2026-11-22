import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { learnerGoalFixture } from "../../../packages/core/src/learner/_test-utils/learner-goal";
import { lowGuessTapItems } from "../../../packages/core/src/learner/_test-utils/placement-tap-items";
import {
  languageLevelTestOutViewSchema,
  languageLevelTestResultSchema,
} from "../src/lib/openapi/schemas/language";
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

test("language placement keeps the level result and hides an unavailable test-out", async () => {
  const { apiContext, user } = await createAuthenticatedApiContext({
    baseURL: process.env.E2E_BASE_URL ?? "",
    prefix: "level-test-finish",
  });

  try {
    const { goal, items, skills } = await languageGoalFixture({ userId: user.id });
    const attemptId = randomUUID();
    const pair = { language: `x${randomUUID().slice(0, 8)}`, targetLanguage: "en" };
    const ahead = items.slice(2);

    await Promise.all([
      prisma.goal.update({
        data: {
          ...pair,
          details: {
            level: "B1",
            levelTest: { attempt: { attemptId, length: "quick", start: 2 } },
          },
        },
        where: { id: goal.id },
      }),
      prisma.languageLevelTest.create({
        data: {
          ...pair,
          content: {
            confirmations: [],
            questions: [
              {
                answerIndex: 0,
                id: "reading-1",
                level: "B1",
                options: ["a", "b", "c", "d"],
                passage: "The library opens late today.",
                question: "What does the sign say?",
                skill: "reading",
              },
            ],
          },
          model: "fixture",
          promptVersion: "fixture",
          runId: "fixture",
        },
      }),
      prisma.skill.updateMany({
        data: { cefrLevel: "B2" },
        where: { id: { in: skills.slice(2).map(({ id }) => id) } },
      }),
      prisma.planItem.updateMany({
        data: { chapterId: null, lessonId: null, lessons: 1 },
        where: { id: { in: ahead.map(({ id }) => id) } },
      }),
    ]);

    const goalPath = `/v1/goals/${goal.id}`;
    const path = `${goalPath}/language-level-test`;

    const finish = async () =>
      readBody({
        response: await apiContext.post(`${path}/completions`, { data: { attemptId } }),
        schema: languageLevelTestResultSchema,
      });

    const finished = await finish();
    expect(finished).toMatchObject({ result: { attemptId, changeId: null, lessonsSkipped: 0 } });
    await expect(finish()).resolves.toStrictEqual(finished);

    await expect(
      readBody({ response: await apiContext.get(`${goalPath}/plan`), schema: planResponseSchema }),
    ).resolves.toMatchObject({ placementTest: { nextTestOutLevel: null, result: { attemptId } } });

    const testOutPath = `${path}/test-outs`;

    const testOut = await readBody({
      response: await apiContext.post(testOutPath, { data: { level: "B2" } }),
      schema: languageLevelTestOutViewSchema,
    });

    expect(testOut).toMatchObject({ level: "B2", next: null, preparing: false, total: 0 });

    const empty = await apiContext.post(`${testOutPath}/completions`, {
      data: { attemptId: testOut.attemptId },
    });

    expect(empty.status()).toBe(404);
  } finally {
    await apiContext.dispose();
  }
});
