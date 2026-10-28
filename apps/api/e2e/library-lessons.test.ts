import { randomUUID } from "node:crypto";
import { type APIRequestContext, request } from "@playwright/test";
import {
  lessonStepCheckResultSchema,
  libraryLessonCompletionSchema,
  libraryLessonRunSchema,
} from "@zoonk/core/lesson-player/contract";
import { createdLessonQuestionSchema } from "@zoonk/core/lesson-questions/contract";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { playableLibraryLessonResponseSchema } from "../src/lib/openapi/schemas/library-lessons";
import { createBearerLearner, createGuest } from "./helpers/bearer";
import { readBody } from "./helpers/response";

const LESSON_STEPS = ["hook", "explanation", "check", "typedAnswer", "summary"] as const;
const RIGHT_TYPED = "It shows where the electron is likely to be";
const OVERNIGHT_MS = 36_000_000;

/** Days since a free exam goal started that put it past its free first week. */
const FREE_WEEK_OVER_DAYS = 10;

function stepId(steps: { id: string; kind: string }[], kind: string): string {
  return steps.find((step) => step.kind === kind)?.id ?? "";
}

async function startRun({ api, lessonId }: { api: APIRequestContext; lessonId: string }) {
  const run = await readBody({
    response: await api.post(`/v1/library/lessons/${lessonId}/starts`, {
      data: { timeZone: "America/Sao_Paulo" },
    }),
    schema: libraryLessonRunSchema,
    status: 201,
  });

  return run.runId;
}

function check({
  answer,
  api,
  durationMs = 4000,
  runId,
  step,
}: {
  answer: object;
  api: APIRequestContext;
  durationMs?: number;
  runId: string;
  step: string;
}) {
  return api.post(`/v1/steps/${step}/checks`, {
    data: { answer, durationMs, runId, timeZone: "America/Sao_Paulo" },
  });
}

test.describe("Library lessons API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test("sends a public lesson's screens only with a session, a guest's included", async () => {
    const [{ lesson, steps }, api] = await Promise.all([
      playableLessonFixture({ steps: [...LESSON_STEPS] }),
      request.newContext({ baseURL }),
    ]);

    const visitor = await api.get(`/v1/library/lessons/${lesson.id}`);
    const visitorText = await visitor.text();

    expect(visitor.status()).toBe(200);
    expect(visitorText).not.toContain('"steps"');

    expect(playableLibraryLessonResponseSchema.parse(JSON.parse(visitorText))).toStrictEqual({
      lesson: {
        description: lesson.description,
        estimatedMinutes: lesson.estimatedMinutes,
        id: lesson.id,
        language: lesson.language,
        title: lesson.title,
      },
      status: "sessionRequired",
    });

    const { guestApi } = await createGuest(baseURL);

    const body = await readBody({
      response: await guestApi.get(`/v1/library/lessons/${lesson.id}`),
      schema: playableLibraryLessonResponseSchema,
    });

    expect(body.status === "ready" && body.lesson.steps.map((step) => step.kind)).toStrictEqual([
      ...LESSON_STEPS,
    ]);

    await guestApi.dispose();

    const writes = await Promise.all([
      api.post(`/v1/library/lessons/${lesson.id}/starts`, { data: {} }),
      api.post(`/v1/library/lessons/${lesson.id}/completions`, { data: { runId: randomUUID() } }),
      check({
        answer: { kind: "check", optionId: "likely" },
        api,
        runId: randomUUID(),
        step: stepId(steps, "check"),
      }),
      api.post(`/v1/steps/${stepId(steps, "typedAnswer")}/answer-explanations`, {
        data: { answer: "No idea" },
      }),
    ]);

    expect(writes.map((response) => response.status())).toStrictEqual([401, 401, 401, 401]);
    await api.dispose();
  });

  [null].forEach((targetLanguage) => {
    test(`skips writing in one lesson (target: ${targetLanguage}) without an answer verdict or a permanent preference`, async () => {
      const [{ api, userId }, { lesson, steps }] = await Promise.all([
        createBearerLearner({ baseURL, prefix: "writing-skip" }),
        playableLessonFixture({
          lesson: { targetLanguage },
          steps: ["typedAnswer", "typedAnswer", "summary"],
        }),
      ]);

      const runId = await startRun({ api, lessonId: lesson.id });

      const skippedWritingStepIds = steps
        .filter((step) => step.kind === "typedAnswer")
        .map((step) => step.id);

      const response = await api.post(`/v1/library/lessons/${lesson.id}/completions`, {
        data: { runId, skippedWritingStepIds },
      });

      const completion = await readBody({ response, schema: libraryLessonCompletionSchema });
      expect(completion).toMatchObject({ correctCount: 0, incorrectCount: 0 });
      expect(await prisma.attempt.count({ where: { userId } })).toBe(0);
      expect(await prisma.mistake.count({ where: { userId } })).toBe(0);

      expect(await prisma.learningEvent.findUniqueOrThrow({ where: { id: runId } })).toMatchObject({
        contentIds: { lessonId: lesson.id, skippedWritingStepIds },
        endedAt: expect.any(Date),
      });

      const repeated = await api.post(`/v1/library/lessons/${lesson.id}/completions`, {
        data: { runId },
      });

      expect(
        await readBody({ response: repeated, schema: libraryLessonCompletionSchema }),
      ).toStrictEqual(completion);

      const nextRun = await startRun({ api, lessonId: lesson.id });

      const incomplete = await api.post(`/v1/library/lessons/${lesson.id}/completions`, {
        data: { runId: nextRun },
      });

      expect(incomplete.status()).toBe(422);
      await api.dispose();
    });
  });

  test("plays a lesson from start to finish and counts it once", async () => {
    const [{ api, userId }, { lesson, steps }] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "library-lesson" }),
      playableLessonFixture({ steps: [...LESSON_STEPS] }),
    ]);

    const runId = await startRun({ api, lessonId: lesson.id });

    const wrong = await readBody({
      response: await check({
        answer: { kind: "check", optionId: "size" },
        api,
        runId,
        step: stepId(steps, "check"),
      }),
      schema: lessonStepCheckResultSchema,
    });

    expect(wrong).toMatchObject({
      correctAnswer: "Where the electron is most likely to be found",
      isCorrect: false,
      savedMistake: true,
    });

    const early = await api.post(`/v1/library/lessons/${lesson.id}/completions`, {
      data: { runId },
    });

    expect(early.status()).toBe(422);

    // Answered the next morning: a screen left open overnight still saves, counted as an hour.
    const typed = await readBody({
      response: await check({
        answer: { kind: "typedAnswer", text: RIGHT_TYPED },
        api,
        durationMs: OVERNIGHT_MS,
        runId,
        step: stepId(steps, "typedAnswer"),
      }),
      schema: lessonStepCheckResultSchema,
    });

    expect(typed).toMatchObject({ isCorrect: true, score: 1 });

    // Starting again (a reload, or coming back within half an hour) resumes the run, answers kept.
    const resumed = await readBody({
      response: await api.post(`/v1/library/lessons/${lesson.id}/starts`, {
        data: { timeZone: "America/Sao_Paulo" },
      }),
      schema: libraryLessonRunSchema,
      status: 201,
    });

    expect(resumed).toMatchObject({
      answers: [
        { isCorrect: false, stepId: stepId(steps, "check") },
        { isCorrect: true, stepId: stepId(steps, "typedAnswer") },
      ],
      runId,
    });

    const [first, again] = await Promise.all([
      api.post(`/v1/library/lessons/${lesson.id}/completions`, { data: { runId } }),
      api.post(`/v1/library/lessons/${lesson.id}/completions`, { data: { runId } }),
    ]);

    const completion = await readBody({ response: first, schema: libraryLessonCompletionSchema });

    expect(completion).toMatchObject({
      correctCount: 1,
      incorrectCount: 1,
      isFirstCompletion: true,
    });

    await expect(again.json()).resolves.toStrictEqual(completion);

    const late = await check({
      answer: { kind: "check", optionId: "likely" },
      api,
      runId,
      step: stepId(steps, "check"),
    });

    expect(late.status()).toBe(409);
    await expect(late.json()).resolves.toMatchObject({ error: { code: "LESSON_RUN_ENDED" } });

    const day = await prisma.dailyProgress.findFirstOrThrow({ where: { userId } });
    expect(day.lessonsCompleted).toBe(1);

    await api.dispose();
  });

  test("refuses answers that don't fit the screen and runs of other learners", async () => {
    const [{ api }, other, { lesson, steps }] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "library-invalid" }),
      createBearerLearner({ baseURL, prefix: "library-other" }),
      playableLessonFixture({ steps: [...LESSON_STEPS] }),
    ]);

    const runId = await startRun({ api, lessonId: lesson.id });

    const [hook, malformed, otherRun] = await Promise.all([
      check({ answer: { kind: "check", optionId: "no" }, api, runId, step: stepId(steps, "hook") }),
      api.post(`/v1/steps/${stepId(steps, "check")}/checks`, { data: { answer: {}, runId } }),
      check({
        answer: { kind: "check", optionId: "likely" },
        api: other.api,
        runId,
        step: stepId(steps, "check"),
      }),
    ]);

    expect([hook.status(), malformed.status(), otherRun.status()]).toStrictEqual([422, 400, 404]);

    await Promise.all([api.dispose(), other.api.dispose()]);
  });

  test("asks a guest to sign up after their three lessons", async () => {
    const [{ guestApi, userId }, { lesson }] = await Promise.all([
      createGuest(baseURL),
      playableLessonFixture({ steps: [...LESSON_STEPS] }),
    ]);

    await usageRecordsFixture({ count: 3, kind: "lessonStart", userId });

    const response = await guestApi.post(`/v1/library/lessons/${lesson.id}/starts`, { data: {} });

    expect(response.status()).toBe(403);

    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "USAGE_LIMIT_REACHED",
        details: { limit: { resource: "lessonStart", tier: "guest" } },
      },
    });

    await guestApi.dispose();
  });

  // rafa3 (Câmara, free, day 12): Today said Plus opens new lessons, yet her plan's lessons
  // opened and were written for her.
  test("holds a free exam plan's new lessons for Plus once its first week is over", async () => {
    const [{ api, userId }, { lesson }, unwritten] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "free-week" }),
      playableLessonFixture({ steps: [...LESSON_STEPS] }),
      libraryLessonFixture(),
    ]);

    const goal = await goalFixture({
      createdAt: new Date(Date.now() - FREE_WEEK_OVER_DAYS * MS_PER_DAY),
      kind: "exam",
      timezone: "America/Sao_Paulo",
      userId,
    });

    await Promise.all([
      learningProfileFixture({ activeGoalId: goal.id, userId }),
      planFixture({
        goalId: goal.id,
        items: [lesson, unwritten].map((planned) => ({ lessonId: planned.id })),
      }),
    ]);

    const plusRequired = { error: { code: "PLUS_REQUIRED" } };

    const start = await api.post(`/v1/library/lessons/${lesson.id}/starts`, {
      data: { timeZone: "America/Sao_Paulo" },
    });

    expect(start.status()).toBe(402);
    await expect(start.json()).resolves.toMatchObject(plusRequired);

    const writing = await api.post(`/v1/library/lessons/${unwritten.id}/generations`);

    expect(writing.status()).toBe(402);
    await expect(writing.json()).resolves.toMatchObject(plusRequired);

    // Nothing was counted, started or written.
    await expect(prisma.usageRecord.count({ where: { userId } })).resolves.toBe(0);
    await expect(prisma.learningEvent.count({ where: { userId } })).resolves.toBe(0);

    await api.dispose();
  });

  test("plays a session block inside its session, continuing its Hyperdrive", async () => {
    const [{ api, userId }, { lesson, steps }] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "library-session" }),
      playableLessonFixture({ steps: [...LESSON_STEPS] }),
    ]);

    const session = await studySessionFixture({ userId });
    await studySessionBlockFixture({ lessonId: lesson.id, sessionId: session.id });

    const run = await readBody({
      response: await api.post(`/v1/library/lessons/${lesson.id}/starts`, {
        data: { studySessionId: session.id, timeZone: "America/Sao_Paulo" },
      }),
      schema: libraryLessonRunSchema,
      status: 201,
    });

    expect(run.hyperdrive).toStrictEqual({ knownStepIds: [], streak: 0 });

    const checked = await check({
      answer: { kind: "check", optionId: "likely" },
      api,
      runId: run.runId,
      step: stepId(steps, "check"),
    });

    expect(checked.status()).toBe(200);

    await expect(
      prisma.attempt.findFirstOrThrow({ where: { stepId: stepId(steps, "check"), userId } }),
    ).resolves.toMatchObject({ studySessionId: session.id });

    await api.dispose();
  });

  test("asks a guest to sign up before the tutor answers a question about a Library lesson", async () => {
    const [{ guestApi }, { lesson }] = await Promise.all([
      createGuest(baseURL),
      playableLessonFixture({ steps: [...LESSON_STEPS] }),
    ]);

    const guestQuestion = await readBody({
      response: await guestApi.post(`/v1/lessons/${lesson.id}/questions`, {
        data: { context: { kind: "lesson" }, question: "Why?", requestId: randomUUID() },
      }),
      schema: createdLessonQuestionSchema,
      status: 201,
    });

    const answer = await guestApi.post(`/v1/questions/${guestQuestion.id}/answers`);

    expect(answer.status()).toBe(403);

    await expect(answer.json()).resolves.toMatchObject({
      error: {
        code: "USAGE_LIMIT_REACHED",
        details: { limit: { resource: "tutorMessage", tier: "guest" } },
      },
    });

    await guestApi.dispose();
  });
});
