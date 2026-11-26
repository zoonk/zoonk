import { request } from "@playwright/test";
import { libraryLessonRunSchema } from "@zoonk/core/lesson-player/contract";
import { saveLessonSchema, savedLessonListSchema } from "@zoonk/core/saved-lessons/contract";
import { expect, test } from "@zoonk/e2e/fixtures";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { completedLessonListResponseSchema } from "../src/lib/openapi/schemas/completed-lessons";
import { learnerSummaryResponseSchema } from "../src/lib/openapi/schemas/learner-summary";
import { createBearerLearner } from "./helpers/bearer";
import { readBody } from "./helpers/response";

test.describe("Saved lessons API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test("sets and reads a save across the goal list, summary, completed lessons and player", async () => {
    const [{ api, userId }, { lesson }] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "saved-lessons" }),
      playableLessonFixture({ steps: ["check"] }),
    ]);

    const goal = await goalFixture({ userId });

    await Promise.all([
      learningProfileFixture({ activeGoalId: goal.id, userId }),
      learningEventFixture({
        contentIds: { lessonId: lesson.id },
        endedAt: new Date(),
        goalId: goal.id,
        lessonKind: "library",
        userId,
      }),
    ]);

    const path = `/v1/goals/${goal.id}/saved-lessons`;

    const list = async () =>
      readBody({ response: await api.get(path), schema: savedLessonListSchema });

    const save = async (saved: boolean) =>
      readBody({
        response: await api.post(path, { data: { lessonId: lesson.id, saved } }),
        schema: saveLessonSchema,
      });

    const readSummary = async () =>
      readBody({ response: await api.get("/v1/me/summary"), schema: learnerSummaryResponseSchema });

    await expect(list()).resolves.toStrictEqual({ lessons: [] });

    await expect(readSummary()).resolves.toMatchObject({
      summary: { places: { savedLessons: false } },
    });

    await expect(Promise.all([save(true), save(true)])).resolves.toStrictEqual([
      { lessonId: lesson.id, saved: true },
      { lessonId: lesson.id, saved: true },
    ]);

    await expect(list()).resolves.toStrictEqual({
      lessons: [{ available: true, chapterTitle: null, lessonId: lesson.id, title: lesson.title }],
    });

    await expect(readSummary()).resolves.toMatchObject({
      summary: { places: { savedLessons: true } },
    });

    const [completed, run] = await Promise.all([
      api.get(`/v1/me/completed-lessons?goalId=${goal.id}`),
      api.post(`/v1/library/lessons/${lesson.id}/starts`, { data: { timeZone: "UTC" } }),
    ]);

    await expect(
      readBody({ response: completed, schema: completedLessonListResponseSchema }),
    ).resolves.toMatchObject({ data: [{ lessonId: lesson.id, saved: true }] });

    await expect(
      readBody({ response: run, schema: libraryLessonRunSchema, status: 201 }),
    ).resolves.toMatchObject({ replay: true, saved: true });

    await expect(save(false)).resolves.toStrictEqual({ lessonId: lesson.id, saved: false });
    await expect(list()).resolves.toStrictEqual({ lessons: [] });

    await expect(readSummary()).resolves.toMatchObject({
      summary: { places: { savedLessons: false } },
    });

    await api.dispose();
  });

  test("requires a session and an owned goal and validates the desired state", async () => {
    const [{ api, userId }, stranger, visitor] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "saved-lessons-access" }),
      userFixture(),
      request.newContext({ baseURL }),
    ]);

    const [ownGoal, strangerGoal] = await Promise.all([
      goalFixture({ userId }),
      goalFixture({ userId: stranger.id }),
    ]);

    const ownPath = `/v1/goals/${ownGoal.id}/saved-lessons`;
    const strangerPath = `/v1/goals/${strangerGoal.id}/saved-lessons`;
    const data = { lessonId: ownGoal.id, saved: false };

    const responses = await Promise.all([
      visitor.get(ownPath),
      visitor.post(ownPath, { data }),
      api.get(strangerPath),
      api.post(strangerPath, { data }),
      api.post(ownPath, { data: { ...data, extra: true } }),
    ]);

    expect(responses.map((response) => response.status())).toStrictEqual([401, 401, 404, 404, 400]);
    await Promise.all([api.dispose(), visitor.dispose()]);
  });
});
