import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { getUsageRule } from "@zoonk/core/entitlements/limits";
import { readMistakeSnapshot } from "@zoonk/core/mistakes/snapshot";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import {
  attemptFixture,
  learnerSkillFixture,
  mistakeFixture,
} from "@zoonk/testing/fixtures/learner";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { ONE_SECOND_RECORDING } from "@zoonk/testing/fixtures/recordings";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import {
  gradeMathAnswer,
  parseMathItem,
} from "../../../packages/core/src/learner/_utils/math-items";
import {
  discountMath,
  discountQuestion,
} from "../../../packages/core/src/library/items/_test-utils/math-problems";
import { withRecordedNumbers } from "../../../packages/core/src/library/items/item-math";
import {
  mistakeLessonSchema,
  mistakeListResponseSchema,
  mistakePracticeCompletionSchema,
  mistakePracticeFeedbackSchema,
  mistakePracticeResponseSchema,
} from "../src/lib/openapi/schemas/mistakes";
import { createBearerLearner } from "./helpers/bearer";
import { tapOption } from "./helpers/choices";
import { readBody } from "./helpers/response";

const DAY_MS = 86_400_000;

async function createMistakeGoal({
  cause,
  userId,
}: {
  cause: "gap" | "time" | "trap";
  userId: string;
}) {
  const [goal, skills, lessons] = await Promise.all([
    goalFixture({ dailyMinutes: 30, timezone: "UTC", userId }),
    Promise.all([skillFixture({ name: "Discounts" }), skillFixture({ name: "Ratios" })]),
    Promise.all([
      libraryLessonFixture({
        summary: { ideas: [{ text: "A discount comes off the price." }] },
        title: "Discounts",
      }),
      libraryLessonFixture({ title: "Ratios" }),
    ]),
  ]);

  const [items] = await Promise.all([
    Promise.all(
      Array.from({ length: 3 }, () =>
        itemFixture({ content: choiceItemContent(), skillId: skills[0]?.id ?? "" }),
      ),
    ),
    ...lessons.map((lesson, index) =>
      lessonSkillFixture({ lessonId: lesson.id, skillId: skills[index]?.id ?? "" }),
    ),
    planFixture({
      goalId: goal.id,
      items: lessons.map((lesson, position) => ({
        lessonId: lesson.id,
        skillId: skills[position]?.id ?? null,
        status: position === 0 ? ("done" as const) : ("todo" as const),
        titleSnapshot: lesson.title,
      })),
    }),
  ]);

  const [mistake] = await Promise.all([
    mistakeFixture({
      cause,
      createdAt: new Date(Date.now() - DAY_MS),
      itemId: items[0]?.id,
      skillId: skills[0]?.id,
      userId,
    }),
    learnerSkillFixture({
      difficulty: 5,
      due: new Date(Date.now() - DAY_MS),
      lastReviewedAt: new Date(Date.now() - 4 * DAY_MS),
      reps: 2,
      skillId: skills[0]?.id ?? "",
      stability: 3,
      state: "learning",
      userId,
    }),
  ]);

  return { goal, lesson: lessons[0], mistake };
}

test.describe("Mistake practice API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("requires authentication to finish a run", async () => {
    const api = await request.newContext({ baseURL });

    const response = await api.post("/v1/me/mistake-practice/completions", {
      data: { answerIds: [randomUUID()] },
    });

    expect(response.status()).toBe(401);
    await api.dispose();
  });

  test("rehearses today's mistake in its block and returns the saved verdict on retry", async () => {
    const [{ api, userId }, stranger] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "scoped-mistake-practice" }),
      createBearerLearner({ baseURL, prefix: "scoped-mistake-stranger" }),
    ]);

    const { goal, mistake } = await createMistakeGoal({ cause: "trap", userId });

    const [today, study] = await Promise.all([
      prisma.mistake.update({ data: { missedAt: new Date() }, where: { id: mistake.id } }),
      studySessionFixture({ goalId: goal.id, startedAt: new Date(), status: "active", userId }),
    ]);

    const anotherItem = await itemFixture({
      content: choiceItemContent(),
      skillId: mistake.skillId!,
    });

    const another = await mistakeFixture({
      itemId: anotherItem.id,
      skillId: mistake.skillId,
      userId,
    });

    const block = await studySessionBlockFixture({
      kind: "review",
      payload: { mistakeIds: [today.id] },
      sessionId: study.id,
      status: "active",
    });

    const blockPath = `/v1/me/mistake-practice?blockId=${block.id}`;
    const answerPath = `/v1/me/mistakes/${today.id}/answers`;
    const completionPath = "/v1/me/mistake-practice/completions";

    try {
      const notebook = await readBody({
        response: await api.get(`/v1/me/mistakes?goalId=${goal.id}`),
        schema: mistakeListResponseSchema,
      });

      expect(notebook.availability).toStrictEqual({ ready: 2 });
      expect(notebook.data.find((entry) => entry.id === today.id)?.practiceAvailable).toBe(true);

      const foreignBlock = await stranger.api.get(blockPath);
      expect(foreignBlock.status()).toBe(404);

      const scoped = await readBody({
        response: await api.get(blockPath),
        schema: mistakePracticeResponseSchema,
      });

      expect(scoped.practice.map((entry) => entry.mistakeId)).toStrictEqual([today.id]);
      const shown = scoped.practice[0]?.questions[0]?.options;

      const completion = { answerIds: [], blockId: block.id, ended: true, timeZone: "UTC" };
      const foreignCompletion = await stranger.api.post(completionPath, { data: completion });
      expect(foreignCompletion.status()).toBe(404);

      const premature = await api.post(completionPath, { data: completion });
      expect(premature.status()).toBe(200);

      await expect(
        prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } }),
      ).resolves.toMatchObject({ status: "active" });

      const input = {
        answer: tapOption(shown),
        attemptId: randomUUID(),
        durationMs: 4000,
        itemId: today.itemId,
        run: { answerIds: [], blockId: block.id },
        timeZone: "UTC",
      };

      const outside = await api.post(`/v1/me/mistakes/${another.id}/answers`, {
        data: { ...input, itemId: anotherItem.id },
      });

      expect(outside.status()).toBe(404);

      const feedback = await readBody({
        response: await api.post(answerPath, { data: input }),
        schema: mistakePracticeFeedbackSchema,
      });

      expect(feedback).toMatchObject({ fixed: false, isCorrect: true, requiresLaterDay: true });

      const retry = await readBody({
        response: await api.post(answerPath, {
          data: { ...input, answer: tapOption(shown, { right: false }) },
        }),
        schema: mistakePracticeFeedbackSchema,
      });

      expect(retry).toStrictEqual(feedback);

      const repeat = await readBody({
        response: await api.post(answerPath, {
          data: {
            ...input,
            answer: tapOption(shown, { right: false }),
            attemptId: randomUUID(),
            run: undefined,
          },
        }),
        schema: mistakePracticeFeedbackSchema,
      });

      expect(repeat).toMatchObject({ fixed: false, isCorrect: false, requiresLaterDay: false });

      const result = await readBody({
        response: await api.post(completionPath, {
          data: { ...completion, answerIds: [feedback.answerId, repeat.answerId] },
        }),
        schema: mistakePracticeCompletionSchema,
      });

      expect(result).toMatchObject({ brainPower: 2, correct: 1, total: 1 });

      await expect(
        prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } }),
      ).resolves.toMatchObject({ status: "completed" });
    } finally {
      await Promise.all([api.dispose(), stranger.api.dispose()]);
    }
  });

  test("settles an all-spoken block without grading after the assist allowance runs out", async () => {
    const { api, userId } = await createBearerLearner({ baseURL, prefix: "spoken-mistake-limit" });

    const [session, lesson] = await Promise.all([
      studySessionFixture({ startedAt: new Date(), status: "active", userId }),
      libraryLessonFixture({ language: "pt", targetLanguage: "en" }),
      usageRecordsFixture({
        count: getUsageRule({ kind: "assist", tier: "free" }).day ?? 0,
        createdAt: new Date(),
        kind: "assist",
        userId,
      }),
    ]);

    const step = await libraryStepFixture({
      content: {
        language: "en",
        prompt: "Ask about the rent.",
        targetText: "How much is the rent?",
      },
      kind: "spokenAnswer",
      lessonId: lesson.id,
    });

    const mistake = await mistakeFixture({ stepId: step.id, userId });

    const block = await studySessionBlockFixture({
      kind: "review",
      payload: { mistakeIds: [mistake.id] },
      sessionId: session.id,
      status: "active",
    });

    try {
      const response = await api.post(`/v1/steps/${step.id}/spoken-answers`, {
        multipart: {
          attemptId: randomUUID(),
          audio: {
            buffer: Buffer.from(ONE_SECOND_RECORDING),
            mimeType: "audio/webm",
            name: "answer.webm",
          },
          blockId: block.id,
          durationMs: "1000",
          mistakeId: mistake.id,
          timeZone: "UTC",
        },
      });

      expect(response.status()).toBe(402);

      await expect(response.json()).resolves.toMatchObject({
        error: { code: "USAGE_LIMIT_REACHED" },
      });

      await expect(
        prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } }),
      ).resolves.toMatchObject({ status: "completed" });

      await expect(prisma.attempt.count({ where: { userId } })).resolves.toBe(0);
    } finally {
      await api.dispose();
    }
  });

  test("keeps a mock's practice hidden until it finishes", async () => {
    const { api, userId } = await createBearerLearner({ baseURL, prefix: "mock-mistake-practice" });
    const { mistake } = await createMistakeGoal({ cause: "gap", userId });

    const mock = await prisma.mockExam.create({
      data: { conditions: {}, sectionStartedAt: new Date(), userId },
    });

    const attempt = await attemptFixture({
      answer: { selectedIndex: 1 },
      isCorrect: false,
      itemId: mistake.itemId,
      mockExamId: mock.id,
      userId,
    });

    try {
      await prisma.mistake.update({
        data: { attemptId: attempt.id, missedAt: new Date() },
        where: { id: mistake.id },
      });

      const path = `/v1/me/mistake-practice?mockId=${mock.id}`;
      const unfinished = await api.get(path);
      expect(unfinished.status()).toBe(404);

      await prisma.mockExam.update({
        data: { finishedAt: new Date(), status: "finished" },
        where: { id: mock.id },
      });

      const scoped = await readBody({
        response: await api.get(path),
        schema: mistakePracticeResponseSchema,
      });

      expect(scoped.practice.map((entry) => entry.mistakeId)).toStrictEqual([mistake.id]);
    } finally {
      await api.dispose();
    }
  });

  test("replays an original lesson question and fixes only that notebook entry", async () => {
    const { api, userId } = await createBearerLearner({ baseURL, prefix: "exact-lesson-mistake" });
    const { goal, lesson } = await createMistakeGoal({ cause: "gap", userId });
    const skill = await prisma.lessonSkill.findFirstOrThrow({ where: { lessonId: lesson!.id } });

    const content = {
      basis: null,
      context: "The saved passage",
      options: [
        { id: "right", isCorrect: true, reason: "Original reason", text: "Original right" },
        { id: "wrong", isCorrect: false, reason: "Try again", text: "Original wrong" },
      ],
      question: "Which original answer?",
    };

    const step = await libraryStepFixture({
      content,
      kind: "check",
      lessonId: lesson!.id,
      skillId: skill.skillId,
    });

    const otherStep = await libraryStepFixture({
      content,
      kind: "check",
      lessonId: lesson!.id,
      skillId: skill.skillId,
    });

    const mistake = await mistakeFixture({
      createdAt: new Date(Date.now() - DAY_MS),
      skillId: skill.skillId,
      stepId: step.id,
      userId,
    });

    const other = await mistakeFixture({
      createdAt: new Date(Date.now() - DAY_MS),
      skillId: skill.skillId,
      stepId: otherStep.id,
      userId,
    });

    const opened = await readBody({
      response: await api.post(`/v1/me/mistakes/${mistake.id}/lesson`),
      schema: mistakeLessonSchema,
    });

    expect(opened).toStrictEqual({ id: lesson!.id, title: lesson!.title });

    const practice = await readBody({
      response: await api.get(`/v1/me/mistake-practice?goalId=${goal.id}&includeAllFormats=true`),
      schema: mistakePracticeResponseSchema,
    });

    expect(practice.practice.find((entry) => entry.mistakeId === mistake.id)).toMatchObject({
      lesson: {
        step: {
          content: { context: "The saved passage", question: "Which original answer?" },
          id: step.id,
        },
      },
      questions: [],
    });

    const payload = {
      answer: { kind: "check", optionId: "right" },
      attemptId: randomUUID(),
      durationMs: 2000,
      stepId: step.id,
      timeZone: "UTC",
    };

    const wrongSource = await api.post(`/v1/me/mistakes/${mistake.id}/answers`, {
      data: { ...payload, stepId: otherStep.id },
    });

    expect(wrongSource.status()).toBe(422);

    const feedback = await readBody({
      response: await api.post(`/v1/me/mistakes/${mistake.id}/answers`, { data: payload }),
      schema: mistakePracticeFeedbackSchema,
    });

    expect(feedback).toMatchObject({
      fixed: true,
      fixedMistakeIds: [mistake.id],
      lessonResult: { checked: true, isCorrect: true },
    });

    await expect(prisma.mistake.findUnique({ where: { id: other.id } })).resolves.toMatchObject({
      status: "open",
    });

    const retry = await readBody({
      response: await api.post(`/v1/me/mistakes/${mistake.id}/answers`, { data: payload }),
      schema: mistakePracticeFeedbackSchema,
    });

    expect(retry).toStrictEqual(feedback);
    await api.dispose();
  });

  test("replays the original numeric serving through the public contract", async () => {
    const { api, userId } = await createBearerLearner({ baseURL, prefix: "exact-numeric-mistake" });
    const { goal, mistake } = await createMistakeGoal({ cause: "gap", userId });

    const row = await itemFixture({
      content: { context: null, math: discountMath, question: discountQuestion },
      format: "numeric",
      skillId: mistake.skillId ?? "",
    });

    const item = parseMathItem(row);

    if (!item) {
      throw new Error("The numeric original must be playable");
    }

    const version = withRecordedNumbers({
      ...item.content,
      language: item.language,
      values: { discount: 20, price: 100 },
    });

    if (!version) {
      throw new Error("The original numbers must be valid");
    }

    const graded = gradeMathAnswer({ answer: 999, item, version });

    const attempt = await attemptFixture({
      answer: graded.recorded,
      answeredAt: new Date(Date.now() - DAY_MS),
      itemId: item.id,
      skillId: item.skillId,
      userId,
    });

    const original = await mistakeFixture({
      attemptId: attempt.id,
      createdAt: new Date(Date.now() - DAY_MS),
      itemId: item.id,
      skillId: item.skillId,
      snapshot: readMistakeSnapshot(graded.snapshot),
      userId,
    });

    const practice = await readBody({
      response: await api.get(`/v1/me/mistake-practice?goalId=${goal.id}&includeAllFormats=true`),
      schema: mistakePracticeResponseSchema,
    });

    expect(practice.practice.find((entry) => entry.mistakeId === original.id)).toMatchObject({
      questions: [
        {
          format: "numeric",
          question: "A shirt costs 100 and is 20% off. How much do you pay?",
          unit: { symbol: "R$" },
        },
      ],
    });

    const payload = {
      answer: { number: 80 },
      attemptId: randomUUID(),
      durationMs: 2000,
      itemId: item.id,
      timeZone: "UTC",
    };

    const feedback = await readBody({
      response: await api.post(`/v1/me/mistakes/${original.id}/answers`, { data: payload }),
      schema: mistakePracticeFeedbackSchema,
    });

    expect(feedback).toMatchObject({
      correctAnswer: { number: 80 },
      fixed: true,
      fixedMistakeIds: [original.id],
      workedSteps: [expect.any(String), expect.any(String)],
    });

    await api.dispose();
  });

  test("counts a run toward today once, and only the learner's own answers", async () => {
    const [{ api, userId }, stranger] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "mistake-practice" }),
      createBearerLearner({ baseURL, prefix: "mistake-practice-stranger" }),
    ]);

    const { goal, mistake } = await createMistakeGoal({ cause: "gap", userId });

    const practice = await readBody({
      response: await api.get(`/v1/me/mistake-practice?goalId=${goal.id}&timeZone=UTC`),
      schema: mistakePracticeResponseSchema,
    });

    const [entry] = practice.practice;

    const feedback = await readBody({
      response: await api.post(`/v1/me/mistakes/${mistake.id}/answers`, {
        data: {
          answer: tapOption(entry?.questions[0]?.options),
          durationMs: 12_000,
          itemId: entry?.questions[0]?.itemId,
          timeZone: "UTC",
        },
      }),
      schema: mistakePracticeFeedbackSchema,
    });

    const finish = {
      answerIds: [feedback.answerId],
      ended: true,
      goalId: goal.id,
      timeZone: "UTC",
    };

    const counted = await readBody({
      response: await api.post("/v1/me/mistake-practice/completions", { data: finish }),
      schema: mistakePracticeCompletionSchema,
    });

    expect(counted).toMatchObject({ brainPower: 2, correct: 1, missionMoment: null, total: 1 });

    const again = await readBody({
      response: await api.post("/v1/me/mistake-practice/completions", { data: finish }),
      schema: mistakePracticeCompletionSchema,
    });

    expect(again).toStrictEqual(counted);

    await expect(
      prisma.learningEvent.findMany({ where: { lessonKind: "mistakePractice", userId } }),
    ).resolves.toMatchObject([{ goalId: goal.id, kind: "questions" }]);

    const stolen = await stranger.api.post("/v1/me/mistake-practice/completions", {
      data: { answerIds: [feedback.answerId], timeZone: "UTC" },
    });

    expect(stolen.status()).toBe(422);

    await Promise.all([api.dispose(), stranger.api.dispose()]);
  });
});
