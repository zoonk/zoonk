import { randomUUID } from "node:crypto";
import { type APIRequestContext, request } from "@playwright/test";
import {
  MAX_LESSON_QUESTION_THREAD_TURNS,
  lessonQuestionResourceSchema,
  lessonQuestionThreadResponseSchema,
} from "@zoonk/core/lesson-questions/contract";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { createBearerLearner } from "./helpers/bearer";
import { readBody } from "./helpers/response";

const LESSON_STEPS = ["explanation", "check", "summary"] as const;
const FREE_DAILY_TUTOR_MESSAGES = 10;
const OVERSIZED_OPTION_ID_LENGTH = 41;
const OVERSIZED_TYPED_ANSWER_LENGTH = 1001;
const OLDER_QUESTION_COUNT = 5;

function stepOf(steps: { id: string; kind: string; position: number }[], kind: string) {
  const step = steps.find((candidate) => candidate.kind === kind);

  if (!step) {
    throw new Error(`The lesson has no ${kind} step`);
  }

  return { id: step.id, stepNumber: step.position + 1 };
}

function ask({
  api,
  context = { kind: "lesson" },
  lessonId,
  question = "Why is it drawn as a cloud?",
  requestId = randomUUID(),
}: {
  api: APIRequestContext;
  context?: object;
  lessonId: string;
  question?: string;
  requestId?: string;
}) {
  return api.post(`/v1/lessons/${lessonId}/questions`, { data: { context, question, requestId } });
}

async function askQuestion(input: Parameters<typeof ask>[0]) {
  return readBody({
    response: await ask(input),
    schema: lessonQuestionResourceSchema,
    status: 201,
  });
}

test.describe("Lesson questions API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test("requires a session to read, ask and answer", async () => {
    const anonymous = await request.newContext({ baseURL });
    const { lesson } = await playableLessonFixture({ steps: [...LESSON_STEPS] });

    const responses = await Promise.all([
      anonymous.get(`/v1/lessons/${lesson.id}/questions`),
      ask({ api: anonymous, lessonId: lesson.id }),
      anonymous.post(`/v1/questions/${randomUUID()}/answers`),
    ]);

    expect(responses.map((response) => response.status())).toStrictEqual([401, 401, 401]);
    await anonymous.dispose();
  });

  test("keeps a private thread, replays a request and refuses to answer a finished turn", async () => {
    const [{ api }, other, { lesson }] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "lesson-question-thread" }),
      createBearerLearner({ baseURL, prefix: "lesson-question-thread-other" }),
      playableLessonFixture({ steps: [...LESSON_STEPS] }),
    ]);

    const empty = await api.get(`/v1/lessons/${lesson.id}/questions`);

    expect(empty.status()).toBe(200);
    await expect(empty.json()).resolves.toBeNull();

    const requestId = randomUUID();
    const question = `How does this connect ${randomUUID()}?`;
    const created = await askQuestion({ api, lessonId: lesson.id, question, requestId });

    expect(created).toMatchObject({ answer: null, context: { kind: "lesson" }, status: "pending" });

    const [read, replay, conflicting, hidden] = await Promise.all([
      api.get(`/v1/questions/${created.id}`),
      ask({ api, lessonId: lesson.id, question, requestId }),
      ask({ api, lessonId: lesson.id, question: `${question} differently`, requestId }),
      other.api.get(`/v1/questions/${created.id}`),
    ]);

    await expect(read.json()).resolves.toStrictEqual(created);
    expect(replay.status()).toBe(201);
    await expect(replay.json()).resolves.toStrictEqual(created);
    expect(conflicting.status()).toBe(409);
    await expect(conflicting.json()).resolves.toMatchObject({ error: { code: "CONFLICT" } });
    expect(hidden.status()).toBe(404);

    await expect(
      readBody({
        response: await api.get(`/v1/lessons/${lesson.id}/questions`),
        schema: lessonQuestionThreadResponseSchema,
      }),
    ).resolves.toMatchObject({ lessonId: lesson.id, questions: [created] });

    await prisma.lessonQuestion.update({
      data: { answer: "A durable answer", status: "completed" },
      where: { id: created.id },
    });

    const answer = await api.post(`/v1/questions/${created.id}/answers`);

    expect(answer.status()).toBe(409);
    await expect(answer.json()).resolves.toMatchObject({ error: { code: "CONFLICT" } });

    await Promise.all([api.dispose(), other.api.dispose()]);
  });

  test("filters a thread by screen and checks the cursor belongs to that screen", async () => {
    const [{ api }, { lesson, steps }] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "lesson-question-steps" }),
      playableLessonFixture({ steps: [...LESSON_STEPS] }),
    ]);

    const [explanation, summary] = [stepOf(steps, "explanation"), stepOf(steps, "summary")];

    const [first, second] = await Promise.all(
      [explanation, summary].map((step) =>
        askQuestion({
          api,
          context: { kind: "step", stepId: step.id, stepNumber: step.stepNumber },
          lessonId: lesson.id,
        }),
      ),
    );

    const path = `/v1/lessons/${lesson.id}/questions`;

    const [stepHistory, otherCursor, lessonHistory, invalidStep] = await Promise.all([
      api.get(`${path}?stepId=${explanation.id}`),
      api.get(`${path}?stepId=${explanation.id}&cursor=${second?.id}`),
      api.get(`${path}?contextKind=lesson`),
      api.get(`${path}?stepId=invalid`),
    ]);

    await expect(
      readBody({ response: stepHistory, schema: lessonQuestionThreadResponseSchema }),
    ).resolves.toMatchObject({ hasMore: false, questions: [first] });

    await expect(
      readBody({ response: lessonHistory, schema: lessonQuestionThreadResponseSchema }),
    ).resolves.toMatchObject({ questions: [] });

    expect([otherCursor.status(), invalidStep.status()]).toStrictEqual([400, 400]);

    await api.dispose();
  });

  test("keeps one unfinished turn when two questions arrive at once", async () => {
    const [{ api, userId }, { lesson }] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "lesson-question-concurrent" }),
      playableLessonFixture({ steps: [...LESSON_STEPS] }),
    ]);

    const responses = await Promise.all([
      ask({ api, lessonId: lesson.id, question: "First question" }),
      ask({ api, lessonId: lesson.id, question: "Second question" }),
    ]);

    expect(
      responses.map((response) => response.status()).toSorted((first, second) => first - second),
    ).toStrictEqual([201, 409]);

    const created = responses.find((response) => response.status() === 201);
    const { id } = lessonQuestionResourceSchema.parse(await created?.json());

    await expect(
      prisma.lessonQuestion.findMany({ where: { thread: { libraryLessonId: lesson.id, userId } } }),
    ).resolves.toMatchObject([{ id, status: "pending" }]);

    await api.dispose();
  });

  test("pages older questions with an opaque cursor", async () => {
    const [{ api }, { lesson }] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "lesson-question-pages" }),
      playableLessonFixture({ steps: [...LESSON_STEPS] }),
    ]);

    const created = await askQuestion({ api, lessonId: lesson.id, question: "Question 1" });
    const stored = await prisma.lessonQuestion.findUniqueOrThrow({ where: { id: created.id } });
    const firstCreatedAt = new Date("2026-01-01T00:00:00.000Z");
    const total = MAX_LESSON_QUESTION_THREAD_TURNS + OLDER_QUESTION_COUNT;

    const answeredAt = (questionNumber: number) =>
      new Date(firstCreatedAt.getTime() + questionNumber * 1000);

    await prisma.$transaction([
      prisma.lessonQuestion.update({
        data: {
          answer: "Answer 1",
          createdAt: firstCreatedAt,
          status: "completed",
          updatedAt: firstCreatedAt,
        },
        where: { id: stored.id },
      }),
      prisma.lessonQuestion.createMany({
        data: Array.from({ length: total - 1 }, (_, index) => ({
          answer: `Answer ${index + 2}`,
          contextKind: "lesson" as const,
          contextSnapshot: stored.contextSnapshot ?? {},
          createdAt: answeredAt(index + 2),
          question: `Question ${index + 2}`,
          requestFingerprint: `page-question-${index + 2}`,
          requestId: randomUUID(),
          status: "completed" as const,
          threadId: stored.threadId,
          updatedAt: answeredAt(index + 2),
        })),
      }),
    ]);

    const path = `/v1/lessons/${lesson.id}/questions`;

    const latest = await readBody({
      response: await api.get(path),
      schema: lessonQuestionThreadResponseSchema,
    });

    expect(latest).toMatchObject({ hasMore: true, nextCursor: expect.any(String) });

    expect(latest?.questions.map(({ question }) => question)).toStrictEqual(
      Array.from(
        { length: MAX_LESSON_QUESTION_THREAD_TURNS },
        (_, index) => `Question ${index + OLDER_QUESTION_COUNT + 1}`,
      ),
    );

    await expect(
      readBody({
        response: await api.get(`${path}?cursor=${latest?.nextCursor}`),
        schema: lessonQuestionThreadResponseSchema,
      }),
    ).resolves.toMatchObject({
      hasMore: false,
      nextCursor: null,
      questions: Array.from({ length: OLDER_QUESTION_COUNT }, (_, index) => ({
        question: `Question ${index + 1}`,
      })),
    });

    const unknownCursor = await api.get(`${path}?cursor=${randomUUID()}`);

    expect(unknownCursor.status()).toBe(400);
    await expect(unknownCursor.json()).resolves.toMatchObject({ error: { code: "BAD_REQUEST" } });

    await api.dispose();
  });

  test("grades an answer on the server and refuses oversized or made-up answers", async () => {
    const [{ api, userId }, { lesson, steps }] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "lesson-question-answers" }),
      playableLessonFixture({ steps: [...LESSON_STEPS] }),
    ]);

    const check = stepOf(steps, "check");

    const answerContext = (answer: object) => ({
      answer,
      kind: "answer",
      stepId: check.id,
      stepNumber: check.stepNumber,
    });

    const [oversizedOption, oversizedText, madeUpOption] = await Promise.all([
      ask({
        api,
        context: answerContext({ kind: "check", optionId: "x".repeat(OVERSIZED_OPTION_ID_LENGTH) }),
        lessonId: lesson.id,
      }),
      ask({
        api,
        context: answerContext({
          kind: "typedAnswer",
          text: "x".repeat(OVERSIZED_TYPED_ANSWER_LENGTH),
        }),
        lessonId: lesson.id,
      }),
      ask({
        api,
        context: answerContext({ kind: "check", optionId: "not-an-option" }),
        lessonId: lesson.id,
      }),
    ]);

    expect([oversizedOption.status(), oversizedText.status()]).toStrictEqual([400, 400]);

    await expect(oversizedOption.json()).resolves.toMatchObject({
      error: { code: "VALIDATION_ERROR" },
    });

    expect(madeUpOption.status()).toBe(422);

    await expect(madeUpOption.json()).resolves.toMatchObject({
      error: { code: "UNPROCESSABLE_ENTITY" },
    });

    await expect(
      prisma.lessonQuestionThread.count({ where: { libraryLessonId: lesson.id, userId } }),
    ).resolves.toBe(0);

    const graded = await askQuestion({
      api,
      context: answerContext({ kind: "check", optionId: "likely" }),
      lessonId: lesson.id,
      question: "Why is this right?",
    });

    expect(graded.context).toStrictEqual({
      kind: "answer",
      stepId: check.id,
      stepNumber: check.stepNumber,
    });

    await expect(
      prisma.lessonQuestion.findUniqueOrThrow({ where: { id: graded.id } }),
    ).resolves.toMatchObject({
      contextSnapshot: {
        answer: {
          isCorrect: true,
          selectedAnswer: "Where the electron is most likely to be found",
        },
      },
    });

    await api.dispose();
  });

  test("answers the earliest unfinished turn first and releases a refused one", async () => {
    const [{ api, userId }, { lesson }] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "lesson-question-order" }),
      playableLessonFixture({ steps: [...LESSON_STEPS] }),
    ]);

    const first = await askQuestion({ api, lessonId: lesson.id, question: "First question" });

    await prisma.lessonQuestion.update({
      data: { answer: "An answer for now", status: "completed" },
      where: { id: first.id },
    });

    const second = await askQuestion({ api, lessonId: lesson.id, question: "Second question" });

    // The first turn is unfinished again, and the tutor allowance is used up so no model is called.
    await Promise.all([
      prisma.lessonQuestion.update({
        data: { answer: null, status: "pending" },
        where: { id: first.id },
      }),
      usageRecordsFixture({ count: FREE_DAILY_TUTOR_MESSAGES, kind: "tutorMessage", userId }),
    ]);

    const [firstAnswer, secondAnswer] = await Promise.all([
      api.post(`/v1/questions/${first.id}/answers`),
      api.post(`/v1/questions/${second.id}/answers`),
    ]);

    expect(firstAnswer.status()).toBe(402);

    await expect(firstAnswer.json()).resolves.toMatchObject({
      error: { code: "USAGE_LIMIT_REACHED", details: { limit: { resource: "tutorMessage" } } },
    });

    expect(secondAnswer.status()).toBe(409);
    await expect(secondAnswer.json()).resolves.toMatchObject({ error: { code: "CONFLICT" } });

    const [storedFirst, storedSecond] = await Promise.all([
      prisma.lessonQuestion.findUniqueOrThrow({ where: { id: first.id } }),
      prisma.lessonQuestion.findUniqueOrThrow({ where: { id: second.id } }),
    ]);

    expect(storedFirst).toMatchObject({ generationRevision: 1, status: "failed" });
    expect(storedSecond).toMatchObject({ generationRevision: 0, status: "pending" });

    await api.dispose();
  });
});
