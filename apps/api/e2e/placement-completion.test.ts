import { randomUUID } from "node:crypto";
import { planChangeSchema } from "@zoonk/core/plans/change-contract";
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
import { tapOption } from "./helpers/choices";
import { readBody } from "./helpers/response";

test("a finished placement returns an Undo ID accepted by Plan", async () => {
  const { apiContext, user } = await createAuthenticatedApiContext({
    baseURL: process.env.E2E_BASE_URL ?? "",
    prefix: "placement-finish",
  });

  try {
    const { goal, skills } = await learnerGoalFixture({
      challengesDone: true,
      itemsPerSkill: 1,
      phases: [2],
      userId: user.id,
    });

    const banks = await Promise.all(skills.map((skill) => lowGuessTapItems(skill.id)));
    const taps = banks.flat();
    const answers = new Map(taps.map(({ item, answer }) => [item.id, answer] as const));
    const goalPath = `/v1/goals/${goal.id}`;
    const path = `${goalPath}/placement`;

    const plan = async () =>
      readBody({ response: await apiContext.get(`${goalPath}/plan`), schema: planResponseSchema });

    await expect(plan()).resolves.toMatchObject({
      placementTest: { kind: "learn", offer: expect.any(Object), state: "start" },
    });

    const opened = await readBody({
      response: await apiContext.post(`${path}/sittings`, { data: { length: "quick" } }),
      schema: placementResponseSchema,
    });

    expect(opened.attempt).toMatchObject({
      answered: 0,
      part: 1,
      partComplete: false,
      questions: 4,
    });

    const attemptId = opened.attempt?.id;

    if (!attemptId) {
      throw new Error("Expected an open placement test");
    }

    const answerNext = async (question: typeof opened.next): Promise<void> => {
      if (!question) {
        return;
      }

      const { itemId } = question;

      const placed = await readBody({
        response: await apiContext.post(`${path}/answers`, {
          data: {
            answer: answers.get(itemId) ?? tapOption(question.options),
            attemptId,
            durationMs: 1000,
            itemId,
          },
        }),
        schema: placementAnswerResponseSchema,
      });

      expect(placed.isCorrect).toBe(true);
      await answerNext(placed.placement.next);
    };

    await answerNext(opened.next);

    const finish = async () =>
      readBody({
        response: await apiContext.post(`${path}/completion`, { data: { attemptId, part: 1 } }),
        schema: placementCompletionResponseSchema,
      });

    const completed = await finish();

    expect(completed).toMatchObject({
      changeId: expect.any(String),
      finish: { answered: expect.any(Number), lessonsSkipped: 1, unknowns: 0 },
      lessonsSkipped: 1,
      result: {
        changeId: expect.any(String),
        course: { chapters: [{ done: 0, lessons: 2, skipped: 1, start: true }], lessons: 2 },
        nextLesson: { title: expect.any(String) },
      },
    });

    await expect(plan()).resolves.toMatchObject({
      placementTest: { kind: "learn", result: completed.result, state: "result" },
    });

    const { changeId } = completed;

    await expect(finish()).resolves.toMatchObject({ changeId, lessonsSkipped: 1 });

    const undone = await apiContext.post(`${goalPath}/plan/changes/${changeId}`, {
      data: { status: "undone" },
    });

    await readBody({ response: undone, schema: planChangeSchema });

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
    const { goal, items, lessons, skills } = await languageGoalFixture({ userId: user.id });
    const attemptId = randomUUID();
    const pair = { language: `pt-x-${randomUUID().slice(0, 5)}`, targetLanguage: "en" };
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
    const nextLesson = { id: lessons[0]!.id, title: lessons[0]!.title };

    expect(finished.result).toMatchObject({
      attemptId,
      changeId: null,
      lessonsSkipped: 0,
      nextLesson,
    });

    await expect(finish()).resolves.toStrictEqual(finished);

    await expect(
      readBody({ response: await apiContext.get(`${goalPath}/plan`), schema: planResponseSchema }),
    ).resolves.toMatchObject({
      placementTest: { nextTestOutLevel: null, result: { attemptId, nextLesson } },
    });

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
