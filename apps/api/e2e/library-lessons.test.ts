import { randomUUID } from "node:crypto";
import { type APIRequestContext, request } from "@playwright/test";
import {
  answerExplanationSchema,
  lessonStepCheckResultSchema,
  libraryLessonCompletionSchema,
  libraryLessonRunSchema,
} from "@zoonk/core/lesson-player/contract";
import { lessonQuestionResourceSchema } from "@zoonk/core/lesson-questions/contract";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { answerExplanationFixture } from "@zoonk/testing/fixtures/library-steps";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { sourceFixture } from "@zoonk/testing/fixtures/sources";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { playableLibraryLessonResponseSchema } from "../src/lib/openapi/schemas/library-lessons";
import { createBearerLearner, createGuest } from "./helpers/bearer";
import { readBody } from "./helpers/response";

const LESSON_STEPS = ["hook", "explanation", "check", "typedAnswer", "summary"] as const;
const RIGHT_TYPED = "It shows where the electron is likely to be";

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
  runId,
  step,
}: {
  answer: object;
  api: APIRequestContext;
  runId: string;
  step: string;
}) {
  return api.post(`/v1/steps/${step}/checks`, {
    data: { answer, durationMs: 4000, runId, timeZone: "America/Sao_Paulo" },
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

  test("says where a screen's facts come from, with the date its public source was checked", async () => {
    const url = "https://www.planalto.gov.br/ccivil_03/leis/l8112cons.htm";

    const [{ api }, { lesson, steps }, law] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "library-lesson-sources" }),
      playableLessonFixture({ steps: ["explanation", "check"] }),
      sourceFixture({
        fetchedAt: new Date("2026-09-12T10:00:00.000Z"),
        publisher: "Planalto",
        title: "Law 8,112",
        url,
      }),
    ]);

    await prisma.step.update({ data: { sourceId: law.id }, where: { id: steps[0]?.id } });

    const body = await readBody({
      response: await api.get(`/v1/library/lessons/${lesson.id}`),
      schema: playableLibraryLessonResponseSchema,
    });

    expect(
      body.status === "ready" &&
        body.lesson.steps.map((step) => ("citation" in step ? step.citation : null)),
    ).toStrictEqual([
      {
        checkedAt: "2026-09-12T10:00:00.000Z",
        kind: "source",
        publisher: "Planalto",
        title: "Law 8,112",
        url,
      },
      null,
    ]);

    await api.dispose();
  });

  test("slows down a learner or guest reading lessons' screens too fast", async () => {
    const [{ api }, { guestApi }, { lesson }] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "library-lesson-reads" }),
      createGuest(baseURL),
      playableLessonFixture({ steps: [...LESSON_STEPS] }),
    ]);

    // E2E servers stand in for the Vercel Firewall: this header answers as the rule's limit would.
    const overLimit = { headers: { "x-e2e-rate-limited": "lesson-steps" } };
    const path = `/v1/library/lessons/${lesson.id}`;

    const [learner, guest, otherRule] = await Promise.all([
      api.get(path, overLimit),
      guestApi.get(path, overLimit),
      api.get(path, { headers: { "x-e2e-rate-limited": "lesson-start" } }),
    ]);

    await Promise.all(
      [learner, guest].map(async (response) => {
        expect(response.status()).toBe(429);
        expect(response.headers()["retry-after"]).toBe("60");

        const text = await response.text();
        expect(text).not.toContain('"steps"');

        expect(JSON.parse(text)).toMatchObject({
          error: { code: "SLOW_DOWN", details: { retryAfterSeconds: 60 } },
        });
      }),
    );

    const body = await readBody({
      response: otherRule,
      schema: playableLibraryLessonResponseSchema,
    });

    expect(body.status).toBe("ready");
    await Promise.all([api.dispose(), guestApi.dispose()]);
  });

  test("returns the outline of a lesson still being written and 404 for unknown lessons", async () => {
    const [unwritten, api] = await Promise.all([
      libraryLessonFixture({ title: "Why colors exist" }),
      request.newContext({ baseURL }),
    ]);

    const [outline, missing, invalid] = await Promise.all([
      api.get(`/v1/library/lessons/${unwritten.id}`),
      api.get(`/v1/library/lessons/${randomUUID()}`),
      api.get("/v1/library/lessons/not-a-uuid"),
    ]);

    await expect(outline.json()).resolves.toMatchObject({
      lesson: { title: "Why colors exist" },
      status: "notGenerated",
    });

    expect([missing.status(), invalid.status()]).toStrictEqual([404, 400]);
    await api.dispose();
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

    const typed = await readBody({
      response: await check({
        answer: { kind: "typedAnswer", text: RIGHT_TYPED },
        api,
        runId,
        step: stepId(steps, "typedAnswer"),
      }),
      schema: lessonStepCheckResultSchema,
    });

    expect(typed).toMatchObject({ isCorrect: true, score: 1 });

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

  test("explains a wrong typed answer with the shared explanation", async () => {
    const [{ api }, { steps }] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "library-explain" }),
      playableLessonFixture({ steps: [...LESSON_STEPS] }),
    ]);

    const typedStepId = stepId(steps, "typedAnswer");

    const storedExplanation = await answerExplanationFixture({
      explanation: "The cloud isn't the electron's size: it maps where it's likely to be.",
      normalizedAnswer: "it's how big the electron is",
      stepId: typedStepId,
    });

    const explained = await readBody({
      response: await api.post(`/v1/steps/${typedStepId}/answer-explanations`, {
        data: { answer: "It's how big the electron is." },
      }),
      schema: answerExplanationSchema,
    });

    expect(explained).toStrictEqual({
      explanation: "The cloud isn't the electron's size: it maps where it's likely to be.",
      explanationId: storedExplanation.id,
      reused: true,
    });

    const right = await api.post(`/v1/steps/${typedStepId}/answer-explanations`, {
      data: { answer: RIGHT_TYPED },
    });

    expect(right.status()).toBe(422);
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
      schema: lessonQuestionResourceSchema,
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
