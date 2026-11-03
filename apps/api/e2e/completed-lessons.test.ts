import { expect, test } from "@zoonk/e2e/fixtures";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { completedLessonListResponseSchema } from "../src/lib/openapi/schemas/completed-lessons";
import { createBearerLearner } from "./helpers/bearer";
import { readBody } from "./helpers/response";

test.describe("Completed lessons API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test("pages a goal's completed lessons by cursor and hides another learner's goal", async () => {
    const [{ api, userId }, stranger, lessons] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "completed-lessons" }),
      userFixture(),
      Promise.all([libraryLessonFixture(), libraryLessonFixture()]),
    ]);

    const [goal, strangerGoal] = await Promise.all([
      goalFixture({ userId }),
      goalFixture({ userId: stranger.id }),
    ]);

    await Promise.all(
      lessons.map((lesson, index) =>
        learningEventFixture({
          contentIds: { lessonId: lesson.id },
          endedAt: new Date(Date.UTC(2026, 9, 20 + index, 15)),
          goalId: goal.id,
          lessonKind: "library",
          userId,
        }),
      ),
    );

    const list = (query: string) => api.get(`/v1/me/completed-lessons?${query}`);

    const first = await readBody({
      response: await list(`goalId=${goal.id}&limit=1`),
      schema: completedLessonListResponseSchema,
    });

    expect(first).toMatchObject({
      data: [{ finishedOn: "2026-10-21", lessonId: lessons[1]?.id, title: lessons[1]?.title }],
      pagination: { hasMore: true },
    });

    const second = await readBody({
      response: await list(`goalId=${goal.id}&limit=1&cursor=${first.pagination.nextCursor}`),
      schema: completedLessonListResponseSchema,
    });

    expect(second).toMatchObject({
      data: [{ lessonId: lessons[0]?.id }],
      pagination: { hasMore: false, nextCursor: null },
    });

    const refused = await Promise.all([
      list(`goalId=${strangerGoal.id}`),
      list(`goalId=${goal.id}&cursor=not-a-cursor`),
      list(`goalId=${goal.id}&limit=101`),
    ]);

    expect(refused.map((response) => response.status())).toStrictEqual([404, 400, 400]);
    await api.dispose();
  });
});
