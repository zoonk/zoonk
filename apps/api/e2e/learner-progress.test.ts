import { type APIRequestContext, type APIResponse, request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture, lessonProgressFixture } from "@zoonk/testing/fixtures/lessons";
import { dailyProgressFixtureMany, userProgressFixture } from "@zoonk/testing/fixtures/progress";
import { stepAttemptFixture } from "@zoonk/testing/fixtures/step-attempts";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { type ZodType } from "zod";
import {
  currentUserActivityResponseSchema,
  currentUserEnergyResponseSchema,
  currentUserLevelResponseSchema,
  currentUserProgressResponseSchema,
  currentUserProgressSnapshotResponseSchema,
  currentUserScorePatternsResponseSchema,
  currentUserScoreResponseSchema,
} from "../src/lib/openapi/schemas/current-user-progress";
import { createAuthenticatedApiContext } from "./helpers/auth";

const PROGRESS_PATHS = [
  "/v1/me/progress",
  "/v1/me/progress/activity",
  "/v1/me/progress/energy",
  "/v1/me/progress/level",
  "/v1/me/progress/score",
  "/v1/me/progress/score/patterns",
  "/v1/me/progress/snapshot",
] as const;

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const LOGICAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

/**
 * Uses the current UTC date because API progress reads intentionally resolve
 * their bounded windows from the request clock instead of accepting test-only
 * date overrides.
 */
function getCurrentUtcDate(): Date {
  const current = new Date();
  return new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate()));
}

/**
 * Reads a response body only after proving the endpoint returned the successful
 * contract expected by the rest of the test.
 */
async function getSuccessfulBody<Body>({
  response,
  schema,
}: {
  response: APIResponse;
  schema: ZodType<Body>;
}): Promise<Body> {
  expect(response.status()).toBe(200);
  return schema.parse(await getResponseBody(response));
}

/**
 * Treats unvalidated network JSON as unknown until an endpoint-specific schema
 * or assertion proves the response contract used by the test.
 */
async function getResponseBody(response: APIResponse): Promise<unknown> {
  const body: unknown = await response.json();
  return body;
}

/**
 * Requests every learner-wide progress resource concurrently while preserving
 * a typed tuple for the resource-specific assertions below.
 */
async function getProgressResponses(apiContext: APIRequestContext) {
  return Promise.all([
    apiContext.get(PROGRESS_PATHS[0]),
    apiContext.get(PROGRESS_PATHS[1]),
    apiContext.get(PROGRESS_PATHS[2]),
    apiContext.get(PROGRESS_PATHS[3]),
    apiContext.get(PROGRESS_PATHS[4]),
    apiContext.get(PROGRESS_PATHS[5]),
    apiContext.get(PROGRESS_PATHS[6]),
  ]);
}

/**
 * Uses bearer authentication for the populated mobile-client scenario while
 * preserving the cookie-authenticated context for cleanup.
 */
async function createBearerProgressContext({
  baseURL,
  prefix,
}: {
  baseURL: string;
  prefix: string;
}): Promise<{ apiContext: APIRequestContext; cookieContext: APIRequestContext; userId: string }> {
  const authenticated = await createAuthenticatedApiContext({ baseURL, prefix });

  const apiContext = await request.newContext({
    baseURL,
    extraHTTPHeaders: {
      Authorization: `Bearer ${authenticated.token}`,
      "x-vercel-ip-timezone": "UTC",
    },
  });

  return { apiContext, cookieContext: authenticated.apiContext, userId: authenticated.user.id };
}

/**
 * Creates one real learning history plus deliberately larger rows for another
 * user so the response proves every aggregate remains caller-scoped.
 */
async function createPopulatedProgress({ userId }: { userId: string }) {
  const today = getCurrentUtcDate();
  const previousDay = new Date(today.getTime() - DAY_IN_MILLISECONDS);
  const otherUser = await userFixture();
  const course = await courseFixture();
  const chapter = await chapterFixture({ courseId: course.id });
  const lesson = await lessonFixture({ chapterId: chapter.id });

  const step = await stepFixture({
    content: { options: [{ feedback: "Correct", isCorrect: true, text: "A" }] },
    kind: "multipleChoice",
    lessonId: lesson.id,
  });

  await Promise.all([
    userProgressFixture({
      currentEnergy: 80,
      lastActiveAt: today,
      totalBrainPower: 15_000n,
      userId,
    }),
    userProgressFixture({
      currentEnergy: 100,
      lastActiveAt: today,
      totalBrainPower: 999_999n,
      userId: otherUser.id,
    }),
    dailyProgressFixtureMany([
      {
        brainPowerEarned: 500,
        correctAnswers: 3,
        date: today,
        energyAtEnd: 80,
        incorrectAnswers: 1,
        interactiveCompleted: 1,
        staticCompleted: 1,
        timeSpentSeconds: 120,
        userId,
      },
      {
        brainPowerEarned: 9999,
        correctAnswers: 100,
        date: previousDay,
        energyAtEnd: 100,
        interactiveCompleted: 10,
        timeSpentSeconds: 9999,
        userId: otherUser.id,
      },
    ]),
    lessonProgressFixture({
      completedAt: today,
      durationSeconds: 120,
      lessonId: lesson.id,
      userId,
    }),
    lessonProgressFixture({
      completedAt: previousDay,
      durationSeconds: 9999,
      lessonId: lesson.id,
      userId: otherUser.id,
    }),
    stepAttemptFixture({
      answer: { selectedOption: 0 },
      answeredAt: today,
      dayOfWeek: today.getUTCDay(),
      durationSeconds: 12,
      hourOfDay: 9,
      isCorrect: true,
      stepId: step.id,
      userId,
    }),
    stepAttemptFixture({
      answer: { selectedOption: 0 },
      answeredAt: previousDay,
      dayOfWeek: previousDay.getUTCDay(),
      durationSeconds: 12,
      hourOfDay: 21,
      isCorrect: true,
      stepId: step.id,
      userId: otherUser.id,
    }),
  ]);

  return { today };
}

test.describe("Learner Progress API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("requires authentication for every current-user progress resource", async () => {
    const apiContext = await request.newContext({ baseURL });
    const responses = await Promise.all(PROGRESS_PATHS.map((path) => apiContext.get(path)));
    const bodies = await Promise.all(responses.map((response) => getResponseBody(response)));

    for (const [index, response] of responses.entries()) {
      expect(response.status()).toBe(401);
      expect(bodies[index]).toMatchObject({ error: { code: "UNAUTHORIZED" } });
    }

    await apiContext.dispose();
  });

  test("returns stable empty resources for a signed-in learner without progress", async () => {
    const { apiContext } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "progress-empty",
    });

    const [summary, activity, energy, level, score, patterns, snapshot] =
      await getProgressResponses(apiContext);

    const summaryBody = await getSuccessfulBody({
      response: summary,
      schema: currentUserProgressResponseSchema,
    });

    const activityBody = await getSuccessfulBody({
      response: activity,
      schema: currentUserActivityResponseSchema,
    });

    expect(summaryBody).toMatchObject({
      activity: { learningDays: 0, totalLearningSeconds: 0, totalLessonCompletions: 0 },
      energy: null,
      level: null,
      score: null,
      scorePatterns: null,
    });

    expect(activityBody.activity.days.length).toBeGreaterThan(360);
    expect(activityBody.activity.days.at(-1)?.date).toMatch(LOGICAL_DATE_PATTERN);

    await expect(
      getSuccessfulBody({ response: energy, schema: currentUserEnergyResponseSchema }),
    ).resolves.toStrictEqual({ energy: null });

    await expect(
      getSuccessfulBody({ response: level, schema: currentUserLevelResponseSchema }),
    ).resolves.toStrictEqual({ level: null });

    await expect(
      getSuccessfulBody({ response: score, schema: currentUserScoreResponseSchema }),
    ).resolves.toStrictEqual({ score: null });

    await expect(
      getSuccessfulBody({ response: patterns, schema: currentUserScorePatternsResponseSchema }),
    ).resolves.toStrictEqual({ patterns: null });

    await expect(
      getSuccessfulBody({ response: snapshot, schema: currentUserProgressSnapshotResponseSchema }),
    ).resolves.toMatchObject({
      snapshot: {
        progressSnapshot: { currentEnergy: 0, learningDays: 0, totalLearningSeconds: 0 },
        totalBrainPower: 0,
      },
    });

    await apiContext.dispose();
  });

  test("returns caller-scoped progress and serializes calendar dates without timestamps", async () => {
    const { apiContext, cookieContext, userId } = await createBearerProgressContext({
      baseURL,
      prefix: "progress-populated",
    });

    const { today } = await createPopulatedProgress({ userId });

    const [summary, activity, energy, level, score, patterns, snapshot] =
      await getProgressResponses(apiContext);

    const [
      summaryBody,
      activityBody,
      energyBody,
      levelBody,
      scoreBody,
      patternsBody,
      snapshotBody,
    ] = await Promise.all([
      getSuccessfulBody({ response: summary, schema: currentUserProgressResponseSchema }),
      getSuccessfulBody({ response: activity, schema: currentUserActivityResponseSchema }),
      getSuccessfulBody({ response: energy, schema: currentUserEnergyResponseSchema }),
      getSuccessfulBody({ response: level, schema: currentUserLevelResponseSchema }),
      getSuccessfulBody({ response: score, schema: currentUserScoreResponseSchema }),
      getSuccessfulBody({ response: patterns, schema: currentUserScorePatternsResponseSchema }),
      getSuccessfulBody({ response: snapshot, schema: currentUserProgressSnapshotResponseSchema }),
    ]);

    expect(summaryBody).toMatchObject({
      activity: { learningDays: 1, totalLearningSeconds: 120, totalLessonCompletions: 1 },
      energy: { currentEnergy: 80 },
      level: { belt: "orange", level: 8, totalBrainPower: 15_000 },
      score: { correctAnswers: 3, incorrectAnswers: 1, score: 75, totalAnswers: 4 },
      scorePatterns: {
        strongestTime: { period: "morning", totalAnswers: 1 },
        strongestWeekday: { dayOfWeek: WEEKDAYS[today.getUTCDay()], totalAnswers: 4 },
      },
    });

    expect(summaryBody.level).not.toHaveProperty("color");

    expect(activityBody.activity.days.at(-1)).toStrictEqual({
      date: today.toISOString().slice(0, 10),
      lessonCompletions: 1,
    });

    expect(energyBody.energy).toMatchObject({
      currentEnergy: 80,
      insights: { averageEnergy: 80, fullEnergyDays: 0 },
    });

    expect(energyBody.energy?.days.at(-1)?.date).toMatch(LOGICAL_DATE_PATTERN);
    expect(levelBody.level).toMatchObject({ belt: "orange", level: 8, totalBrainPower: 15_000 });
    expect(levelBody.level).not.toHaveProperty("color");
    expect(scoreBody.score).toMatchObject({ score: 75, totalAnswers: 4 });
    expect(scoreBody.score?.periodStart).toMatch(LOGICAL_DATE_PATTERN);
    expect(scoreBody.score?.periodEnd).toMatch(LOGICAL_DATE_PATTERN);
    expect(scoreBody.score?.dataPoints.at(-1)?.date).toMatch(LOGICAL_DATE_PATTERN);
    expect(scoreBody.score?.dataPoints.at(-1)).not.toHaveProperty("label");
    expect(patternsBody.patterns?.weekdays).toHaveLength(7);
    expect(patternsBody.patterns?.times).toHaveLength(4);

    expect(patternsBody.patterns?.weekdays.map(({ dayOfWeek }) => dayOfWeek)).toStrictEqual(
      WEEKDAYS,
    );

    expect(patternsBody.patterns?.times.map(({ period }) => period)).toStrictEqual([
      "night",
      "morning",
      "afternoon",
      "evening",
    ]);

    expect(patternsBody.patterns?.strongestTime).toMatchObject({
      period: "morning",
      totalAnswers: 1,
    });

    expect(snapshotBody.snapshot).toMatchObject({
      progressSnapshot: {
        currentEnergy: 80,
        learningDays: 1,
        todayBrainPower: 500,
        todayCompletedLessons: 2,
        totalLearningSeconds: 120,
      },
      totalBrainPower: 15_000,
    });

    expect(snapshotBody.snapshot.progressSnapshot.bestDayScores).toContainEqual({
      correctAnswers: 3,
      dayOfWeek: WEEKDAYS[today.getUTCDay()],
      incorrectAnswers: 1,
    });

    await Promise.all([apiContext.dispose(), cookieContext.dispose()]);
  });
});
