import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { expect, test } from "@zoonk/e2e/fixtures";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { catalogCourseFixture } from "@zoonk/testing/fixtures/library-courses";
import { createAuthenticatedApiContext } from "./helpers/auth";

const baseURL = process.env.E2E_BASE_URL ?? "";
const HOUR_MS = 3_600_000;

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * HOUR_MS);
}

function startedLessonFixture({
  chapterId,
  startedAt,
  userId,
}: {
  chapterId: string;
  startedAt: Date;
  userId: string;
}) {
  return learningEventFixture({
    contentIds: { chapterId, lessonId: randomUUID() },
    endedAt: startedAt,
    seconds: 0,
    userId,
  });
}

test.describe("Current learner courses API", () => {
  test("requires authentication", async () => {
    const apiContext = await request.newContext({ baseURL });
    const response = await apiContext.get("/v1/me/courses");

    expect(response.status()).toBe(401);

    await apiContext.dispose();
  });

  test("lists goal courses and courses of started lessons, most recent activity first", async () => {
    const [{ apiContext, user }, other, goalCourse, startedCourse, othersCourse] =
      await Promise.all([
        createAuthenticatedApiContext({ baseURL, prefix: "me-courses" }),
        createAuthenticatedApiContext({ baseURL, prefix: "other-courses" }),
        catalogCourseFixture({ lessonCounts: [1] }),
        catalogCourseFixture({ lessonCounts: [1] }),
        catalogCourseFixture({ lessonCounts: [1] }),
      ]);

    const privateCourse = await courseFixture({ userId: user.id, visibility: "private" });

    await Promise.all([
      goalFixture({
        primaryCourseId: goalCourse.course.id,
        status: "completed",
        updatedAt: hoursAgo(3),
        userId: user.id,
      }),
      goalFixture({ primaryCourseId: privateCourse.id, updatedAt: hoursAgo(4), userId: user.id }),
      startedLessonFixture({
        chapterId: startedCourse.chapters[0]!.id,
        startedAt: hoursAgo(1),
        userId: user.id,
      }),
      startedLessonFixture({
        chapterId: othersCourse.chapters[0]!.id,
        startedAt: hoursAgo(1),
        userId: other.user.id,
      }),
    ]);

    const response = await apiContext.get("/v1/me/courses");

    expect(response.status()).toBe(200);

    const body = await response.json();

    expect(body.data.map((course: { id: string }) => course.id)).toStrictEqual([
      startedCourse.course.id,
      goalCourse.course.id,
      privateCourse.id,
    ]);

    expect(body.data[0].organization).toMatchObject({ slug: startedCourse.organization.slug });
    expect(body.data[2].organization).toBeNull();
    expect(body.pagination).toEqual({ hasMore: false, nextCursor: null });

    await Promise.all([apiContext.dispose(), other.apiContext.dispose()]);
  });
});
