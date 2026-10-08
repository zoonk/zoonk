import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { examResultResponseSchema, examViewResponseSchema } from "../src/lib/openapi/schemas/exams";
import {
  anytimeMockResponseSchema,
  mockOptionsResponseSchema,
  mockPlanOfferResultSchema,
  mockStepResponseSchema,
  mockViewResponseSchema,
} from "../src/lib/openapi/schemas/mocks";
import { todayResponseSchema } from "../src/lib/openapi/schemas/today";
import { createBearerLearner } from "./helpers/bearer";
import {
  DAY_MS,
  EXAM_IN_DAYS,
  MOCK_QUESTIONS,
  createExamGoal,
  examEdition,
  isoDayFromToday,
} from "./helpers/exams";
import { readBody } from "./helpers/response";

const REPORT = { maxScore: 12, passed: true, scale: "points", score: 10 } as const;

test.describe("Exams API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("requires authentication", async () => {
    const api = await request.newContext({ baseURL });
    const id = randomUUID();

    const responses = await Promise.all([
      api.get(`/v1/goals/${id}/exam`),
      api.put(`/v1/goals/${id}/exam-result`, { data: REPORT }),
      api.post(`/v1/goals/${id}/exam-moves`),
      api.get(`/v1/mocks/${id}`),
      api.post(`/v1/mocks/${id}/starts`, { data: {} }),
      api.post(`/v1/mocks/${id}/finishes`, { data: {} }),
      api.post(`/v1/mocks/${id}/plan-changes`, { data: { offer: "skip", timeZone: "UTC" } }),
      api.get(`/v1/goals/${id}/mocks`),
      api.post(`/v1/goals/${id}/mocks`, { data: {} }),
      api.post(`/v1/goals/${id}/mocks/generations`, { data: {} }),
      api.get(`/v1/essays/${id}`),
    ]);

    expect(responses.map((response) => response.status())).toStrictEqual(responses.map(() => 401));
    await api.dispose();
  });

  test("runs a mock in real conditions, then takes the official result after the exam", async () => {
    const [{ api, userId }, other] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "exam" }),
      createBearerLearner({ baseURL, prefix: "exam-other" }),
    ]);

    const { blueprintId, goal } = await createExamGoal(userId);

    const { session: today } = await readBody({
      response: await api.get(`/v1/today?goalId=${goal.id}&timeZone=UTC`),
      schema: todayResponseSchema,
    });

    const block = today.blocks.find((candidate) => candidate.checkpoint?.mock);
    const path = `/v1/mocks/${block?.id}`;

    const intro = await readBody({ response: await api.get(path), schema: mockViewResponseSchema });

    expect(intro).toMatchObject({
      current: null,
      number: 1,
      questions: MOCK_QUESTIONS,
      scoring: "net",
      status: "ready",
    });

    const [hidden, start] = await Promise.all([
      other.api.get(path),
      api.post(`${path}/starts`, { data: { timeZone: "UTC" } }),
    ]);

    expect(hidden.status()).toBe(404);
    expect(start.status()).toBe(204);

    const running = await readBody({
      response: await api.get(path),
      schema: mockViewResponseSchema,
    });

    const questions = running.current?.questions ?? [];

    expect(questions).toHaveLength(MOCK_QUESTIONS);
    expect(JSON.stringify(running.current)).not.toContain("isCorrect");

    // The first question is left blank and flagged as unsure; the rest are right.
    await questions.reduce(async (previous, question, index) => {
      await previous;

      const response = await api.put(`${path}/answers`, {
        data: {
          answer: index === 0 ? null : { selectedIndex: 0 },
          durationMs: 5000,
          flagged: index === 0,
          itemId: question.itemId,
        },
      });

      expect(response.status()).toBe(204);
    }, Promise.resolve());

    const step = await readBody({
      response: await api.post(`${path}/sections/0/submissions`, { data: { timeZone: "UTC" } }),
      schema: mockStepResponseSchema,
    });

    expect(step.status).toBe("finished");

    const finished = await readBody({
      response: await api.get(path),
      schema: mockViewResponseSchema,
    });

    expect(finished).toMatchObject({
      result: {
        net: { blank: 1, net: MOCK_QUESTIONS - 1, right: MOCK_QUESTIONS - 1, wrong: 0 },
        scoring: "net",
      },
      status: "finished",
    });

    const resultPath = `/v1/goals/${goal.id}/exam-result?timeZone=UTC`;
    const early = await api.put(resultPath, { data: REPORT });

    expect(early.status()).toBe(409);
    expect(await early.json()).toMatchObject({ error: { code: "EXAM_NOT_TAKEN_YET" } });

    // The exam was yesterday, for a goal started weeks before it.
    await Promise.all([
      prisma.examBlueprint.update({
        data: { edition: examEdition(isoDayFromToday(-1)) },
        where: { id: blueprintId },
      }),
      prisma.goal.update({
        data: { createdAt: new Date(Date.now() - EXAM_IN_DAYS * DAY_MS) },
        where: { id: goal.id },
      }),
    ]);

    const reported = await readBody({
      response: await api.put(resultPath, { data: REPORT }),
      schema: examResultResponseSchema,
    });

    expect(reported).toMatchObject({ passed: true, scale: "points", score: 10 });

    const exam = await readBody({
      response: await api.get(`/v1/goals/${goal.id}/exam?timeZone=UTC`),
      schema: examViewResponseSchema,
    });

    expect(exam).toMatchObject({
      examName: "Concurso Test",
      mocks: [{ correct: MOCK_QUESTIONS - 1, number: 1, scoring: "net", total: MOCK_QUESTIONS }],
      result: { score: 10 },
      scoring: { method: "net" },
      stage: "afterExam",
    });

    const otherExam = await other.api.get(`/v1/goals/${goal.id}/exam`);
    expect(otherExam.status()).toBe(404);
  });

  test("finishes a running mock early, counting unanswered questions as blank", async () => {
    const [{ api, userId }, other] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "mock-finish" }),
      createBearerLearner({ baseURL, prefix: "mock-finish-other" }),
    ]);

    const { goal } = await createExamGoal(userId);

    const { session: today } = await readBody({
      response: await api.get(`/v1/today?goalId=${goal.id}&timeZone=UTC`),
      schema: todayResponseSchema,
    });

    const path = `/v1/mocks/${today.blocks.find((block) => block.checkpoint?.mock)?.id}`;
    const inUtc = { data: { timeZone: "UTC" } };

    const notStarted = await api.post(`${path}/finishes`, inUtc);

    expect(notStarted.status()).toBe(409);
    await expect(notStarted.json()).resolves.toMatchObject({ error: { code: "MOCK_NOT_RUNNING" } });

    const started = await api.post(`${path}/starts`, inUtc);
    expect(started.status()).toBe(204);

    const running = await readBody({
      response: await api.get(path),
      schema: mockViewResponseSchema,
    });

    const [right, wrong] = running.current?.questions ?? [];

    // One right and one wrong; the other questions are never answered.
    const saved = [
      await api.put(`${path}/answers`, {
        data: {
          answer: { selectedIndex: 0 },
          durationMs: 5000,
          flagged: false,
          itemId: right?.itemId,
        },
      }),
      await api.put(`${path}/answers`, {
        data: {
          answer: { selectedIndex: 1 },
          durationMs: 5000,
          flagged: false,
          itemId: wrong?.itemId,
        },
      }),
    ];

    expect(saved.map((response) => response.status())).toStrictEqual([204, 204]);

    const refusals = await Promise.all([
      other.api.post(`${path}/finishes`, inUtc),
      api.post("/v1/mocks/not-a-block/finishes", inUtc),
      api.post(`${path}/finishes`, { data: { timeZone: "Mars/Olympus" } }),
      api.post(`${path}/finishes`, { data: { section: 0, timeZone: "UTC" } }),
    ]);

    expect(refusals.map((response) => response.status())).toStrictEqual([404, 400, 400, 400]);

    const finished = await readBody({
      response: await api.post(`${path}/finishes`, inUtc),
      schema: mockStepResponseSchema,
    });

    expect(finished).toStrictEqual({ status: "finished" });

    const view = await readBody({ response: await api.get(path), schema: mockViewResponseSchema });
    const blank = MOCK_QUESTIONS - 2;

    expect(view).toMatchObject({
      current: null,
      result: { net: { blank, net: 0, right: 1, wrong: 1 }, scoring: "net" },
      status: "finished",
    });

    expect(view.review.map((question) => question.outcome).toSorted()).toStrictEqual([
      ...Array.from({ length: blank }, () => "blank"),
      "wrong",
    ]);

    // A retried finish, after a dropped connection, reads as finished instead of failing.
    const retried = await api.post(`${path}/finishes`, inUtc);

    expect(retried.status()).toBe(200);
    await Promise.all([api.dispose(), other.api.dispose()]);
  });

  test("takes a mock any time, then skips what it showed the learner knows once they say so", async () => {
    const [{ api, userId }, other] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "anytime-mock" }),
      createBearerLearner({ baseURL, prefix: "anytime-mock-other" }),
    ]);

    const { goal } = await createExamGoal(userId);
    const mocksPath = `/v1/goals/${goal.id}/mocks`;
    const half = { area: null, day: null, kind: "half" } as const;

    const options = await readBody({
      response: await api.get(mocksPath),
      schema: mockOptionsResponseSchema,
    });

    expect(options).toMatchObject({
      access: "open",
      options: [
        { kind: "full", minutes: 24, questions: 12 },
        { kind: "half", minutes: 12, questions: MOCK_QUESTIONS },
      ],
      running: null,
    });

    // The bank holds half the exam's questions: the full one needs more written first.
    const [hidden, full] = await Promise.all([
      other.api.get(mocksPath),
      readBody({
        response: await api.post(mocksPath, {
          data: { shape: { ...half, kind: "full" }, timeZone: "UTC" },
        }),
        schema: anytimeMockResponseSchema,
      }),
    ]);

    expect(hidden.status()).toBe(404);
    expect(full).toStrictEqual({ id: null, status: "needsQuestions" });

    const started = await readBody({
      response: await api.post(mocksPath, { data: { shape: half, timeZone: "UTC" } }),
      schema: anytimeMockResponseSchema,
      status: 201,
    });

    const path = `/v1/mocks/${started.id}`;

    const running = await readBody({
      response: await api.get(path),
      schema: mockViewResponseSchema,
    });

    expect(running).toMatchObject({
      purpose: "practice",
      sessionId: null,
      shape: half,
      status: "running",
    });

    await (running.current?.questions ?? []).reduce(async (previous, question) => {
      await previous;

      await api.put(`${path}/answers`, {
        data: {
          answer: { selectedIndex: 0 },
          durationMs: 5000,
          flagged: false,
          itemId: question.itemId,
        },
      });
    }, Promise.resolve());

    await api.post(`${path}/sections/0/submissions`, { data: { timeZone: "UTC" } });

    const finished = await readBody({
      response: await api.get(path),
      schema: mockViewResponseSchema,
    });

    expect(finished).toMatchObject({
      adapt: { skip: { lessons: 1, topics: ["Statutes"] } },
      result: { topics: [{ correct: MOCK_QUESTIONS, name: "Statutes", total: MOCK_QUESTIONS }] },
      status: "finished",
    });

    const skipped = await readBody({
      response: await api.post(`${path}/plan-changes`, {
        data: { offer: "skip", timeZone: "UTC" },
      }),
      schema: mockPlanOfferResultSchema,
    });

    expect(skipped).toMatchObject({ lessonsSkipped: 1, reason: null, status: "applied" });

    const again = await readBody({
      response: await api.post(`${path}/plan-changes`, {
        data: { offer: "skip", timeZone: "UTC" },
      }),
      schema: mockPlanOfferResultSchema,
    });

    expect(again).toStrictEqual({
      changeId: null,
      lessonsSkipped: 0,
      reason: null,
      status: "unchanged",
    });

    await Promise.all([api.dispose(), other.api.dispose()]);
  });

  test("every mock exam comes with Plus, the diagnostic one in onboarding included", async () => {
    const { api, userId } = await createBearerLearner({ baseURL, prefix: "anytime-mock-free" });
    const { goal } = await createExamGoal(userId);

    await prisma.subscription.deleteMany({ where: { referenceId: userId } });

    const shape = { area: null, day: null, kind: "half" } as const;
    const placement = { length: "short", purpose: "placement" } as const;

    const [options, start, writing, placementStart] = await Promise.all([
      readBody({
        response: await api.get(`/v1/goals/${goal.id}/mocks`),
        schema: mockOptionsResponseSchema,
      }),
      api.post(`/v1/goals/${goal.id}/mocks`, { data: { shape, timeZone: "UTC" } }),
      api.post(`/v1/goals/${goal.id}/mocks/generations`, { data: { shape } }),
      api.post(`/v1/goals/${goal.id}/mocks`, { data: { ...placement, timeZone: "UTC" } }),
    ]);

    // The free plan still sees the diagnostic mock's lengths, with what it takes.
    expect(options).toMatchObject({
      access: "plusRequired",
      placement: { mock: null, options: [{ length: "short" }, { length: "long" }] },
    });

    expect([start.status(), writing.status(), placementStart.status()]).toStrictEqual([
      402, 402, 402,
    ]);

    await expect(placementStart.json()).resolves.toMatchObject({
      error: { code: "PLUS_REQUIRED" },
    });

    await api.dispose();
  });
});
