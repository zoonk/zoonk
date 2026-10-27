import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { examResultResponseSchema, examViewResponseSchema } from "../src/lib/openapi/schemas/exams";
import {
  mockEssayGradesResponseSchema,
  mockStepResponseSchema,
  mockViewResponseSchema,
} from "../src/lib/openapi/schemas/mock-exam";
import {
  anytimeMockResponseSchema,
  mockOptionsResponseSchema,
  mockPlanOfferResultSchema,
} from "../src/lib/openapi/schemas/mocks";
import { createBearerLearner } from "./helpers/bearer";
import { FORMATS_QUESTIONS, createFormatsExamGoal } from "./helpers/exam-formats";
import {
  BREAK_SECTION_QUESTIONS,
  DAY_MS,
  EXAM_IN_DAYS,
  MOCK_QUESTIONS,
  createBreakExamGoal,
  createExamGoal,
  examEdition,
  isoDayFromToday,
} from "./helpers/exams";
import { openStudyDay } from "./helpers/open-study-day";
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
      api.post(`/v1/mocks/${id}/break-ends`),
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

    const today = await openStudyDay({ api, goalId: goal.id });

    const block = today.blocks.find((candidate) => candidate.checkpoint?.mock);
    const path = `/v1/mocks/${block?.id}`;

    const intro = await readBody({ response: await api.get(path), schema: mockViewResponseSchema });

    expect(intro).toMatchObject({ current: null, number: 1, scoring: "net", status: "ready" });

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

    await readBody({
      response: await api.get(`/v1/goals/${goal.id}/exam?timeZone=UTC`),
      schema: examViewResponseSchema,
    });

    const otherExam = await other.api.get(`/v1/goals/${goal.id}/exam`);
    expect(otherExam.status()).toBe(404);
  });

  test("finishes a running mock early, counting unanswered questions as blank, and says the mission it completed", async () => {
    const [{ api, userId }, other] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "mock-finish" }),
      createBearerLearner({ baseURL, prefix: "mock-finish-other" }),
    ]);

    const { goal } = await createExamGoal(userId);

    const today = await openStudyDay({ api, goalId: goal.id });

    const mock = today.blocks.find((block) => block.checkpoint?.mock);
    const path = `/v1/mocks/${mock?.id}`;
    const inUtc = { data: { timeZone: "UTC" } };

    // Taking the plan's mock is the day's only mission.
    await prisma.studySession.update({
      data: {
        missions: {
          picks: [
            {
              anchor: { blockKind: "checkpoint", planItemId: mock?.planItemId },
              kind: "mock",
              total: 1,
            },
          ],
          version: 1,
        },
      },
      where: { id: today.id },
    });

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

    // Its essays are graded once it's handed in.
    const gradedTooSoon = await api.post(`${path}/essay-grades`, inUtc);

    expect(gradedTooSoon.status()).toBe(409);

    await expect(gradedTooSoon.json()).resolves.toMatchObject({
      error: { code: "MOCK_NOT_FINISHED" },
    });

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

    // Handing it in completed the day's last mission, and every read of it today says so.
    expect(view.missionMoment).toMatchObject({
      completed: ["mock"],
      fullMeal: { bonus: 50, paid: true },
      missions: [{ kind: "mock", status: "done" }],
    });

    // A retried finish, after a dropped connection, reads as finished instead of failing.
    const retried = await api.post(`${path}/finishes`, inUtc);

    expect(retried.status()).toBe(200);

    await expect(
      readBody({ response: await api.get(path), schema: mockViewResponseSchema }),
    ).resolves.toMatchObject({ missionMoment: view.missionMoment });

    await expect(
      readBody({
        response: await api.post(`${path}/essay-grades`, inUtc),
        schema: mockEssayGradesResponseSchema,
      }),
    ).resolves.toStrictEqual({ status: "graded" });

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

    await readBody({ response: await api.get(mocksPath), schema: mockOptionsResponseSchema });

    // The bank holds half the exam's questions: the full one needs more written first.
    const [hidden, full] = await Promise.all([
      other.api.get(mocksPath),
      readBody({
        response: await api.post(mocksPath, { data: { shape: { ...half, kind: "full" } } }),
        schema: anytimeMockResponseSchema,
      }),
    ]);

    expect(hidden.status()).toBe(404);
    expect(full).toStrictEqual({ id: null, status: "needsQuestions" });

    const started = await readBody({
      response: await api.post(mocksPath, { data: { shape: half } }),
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

    await readBody({ response: await api.get(path), schema: mockViewResponseSchema });

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

  test("keeps the notice's break between sections, with each section's tools, and ends it early on request", async () => {
    const [{ api, userId }, other] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "mock-break" }),
      createBearerLearner({ baseURL, prefix: "mock-break-other" }),
    ]);

    const { goal } = await createBreakExamGoal(userId);
    const full = { area: null, day: null, kind: "full" } as const;

    const started = await readBody({
      response: await api.post(`/v1/goals/${goal.id}/mocks`, { data: { shape: full } }),
      schema: anytimeMockResponseSchema,
      status: 201,
    });

    const path = `/v1/mocks/${started.id}`;

    const readMock = async () =>
      readBody({ response: await api.get(path), schema: mockViewResponseSchema });

    await readMock();

    const tooSoon = await api.post(`${path}/break-ends`);

    expect(tooSoon.status()).toBe(409);
    await expect(tooSoon.json()).resolves.toMatchObject({ error: { code: "MOCK_NOT_ON_BREAK" } });

    const step = await readBody({
      response: await api.post(`${path}/sections/0/submissions`, { data: { timeZone: "UTC" } }),
      schema: mockStepResponseSchema,
    });

    expect(step.status).toBe("next");

    // On the break: no section runs, and the next one's clock starts when it ends.
    const onBreak = await readMock();
    const breakLeft = new Date(onBreak.breakUntil ?? 0).getTime() - Date.now();

    expect(onBreak.current).toBeNull();
    expect(breakLeft).toBeGreaterThan(9 * 60_000);
    expect(breakLeft).toBeLessThanOrEqual(10 * 60_000);

    const [hidden, ended] = await Promise.all([
      other.api.post(`${path}/break-ends`),
      api.post(`${path}/break-ends`),
    ]);

    expect(hidden.status()).toBe(404);
    expect(ended.status()).toBe(204);

    const next = await readMock();

    expect(next).toMatchObject({
      breakUntil: null,
      sections: [{ status: "done" }, { status: "current" }],
    });

    expect(next.current?.questions).toHaveLength(BREAK_SECTION_QUESTIONS);

    await Promise.all([api.dispose(), other.api.dispose()]);
  });

  test("asks and scores the exam's own answer formats: several picks with the notice's partial credit, a number and a word", async () => {
    const { api, userId } = await createBearerLearner({ baseURL, prefix: "mock-formats" });
    const { goal, itemIds } = await createFormatsExamGoal(userId);

    const started = await readBody({
      response: await api.post(`/v1/goals/${goal.id}/mocks`, {
        data: { shape: { area: null, day: null, kind: "full" } },
      }),
      schema: anytimeMockResponseSchema,
      status: 201,
    });

    const path = `/v1/mocks/${started.id}`;

    const readMock = async () =>
      readBody({ response: await api.get(path), schema: mockViewResponseSchema });

    const running = await readMock();
    const questions = running.current?.questions ?? [];
    const byId = new Map(questions.map((question) => [question.itemId, question]));

    expect(questions).toHaveLength(FORMATS_QUESTIONS);
    expect(byId.get(itemIds.picks)).toMatchObject({ format: "multipleChoice", select: "all" });

    expect(byId.get(itemIds.number)).toMatchObject({
      entry: { kind: "fraction", places: null },
      format: "numeric",
    });

    expect(byId.get(itemIds.word)).toMatchObject({ format: "typed", options: null });

    const save = (itemId: string, answer: object) =>
      api.put(`${path}/answers`, { data: { answer, durationMs: 4000, flagged: false, itemId } });

    // Words only go to a question answered in words.
    const wrongShape = await save(itemIds.picks, { text: "2 + 2 = 4" });

    expect(wrongShape.status()).toBe(422);

    const quick = questions.filter((question) => question.format === "multipleChoice");

    const saved = await Promise.all([
      save(itemIds.picks, { selectedIndexes: [0] }),
      save(itemIds.number, { number: 2 / 3 }),
      save(itemIds.word, { text: "prime" }),
      ...quick
        .filter((question) => question.itemId !== itemIds.picks)
        .map((question) => save(question.itemId, { selectedIndex: 0 })),
    ]);

    expect(saved.map((response) => response.status())).toStrictEqual(saved.map(() => 204));

    await api.post(`${path}/sections/0/submissions`, { data: { timeZone: "UTC" } });

    const finished = await readMock();
    expect(finished.status).toBe("finished");
    await api.dispose();
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
