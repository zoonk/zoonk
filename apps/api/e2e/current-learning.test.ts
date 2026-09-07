import { request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture, courseUserFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture, lessonProgressFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { createAuthenticatedApiContext } from "./helpers/auth";

test.describe("Current learner catalog API", () => {
  test("requires authentication for learner-owned resources", async () => {
    const apiContext = await request.newContext({ baseURL: process.env.E2E_BASE_URL });

    const [coursesResponse, removeCourseResponse, continuationsResponse, visibilityResponse] =
      await Promise.all([
        apiContext.get("/v1/me/courses"),
        apiContext.delete("/v1/me/courses/00000000-0000-4000-8000-000000000001"),
        apiContext.get("/v1/me/course-continuations"),
        apiContext.get("/v1/me/lesson-visibility"),
      ]);

    expect(coursesResponse.status()).toBe(401);
    expect(removeCourseResponse.status()).toBe(401);
    expect(continuationsResponse.status()).toBe(401);
    expect(visibilityResponse.status()).toBe(401);

    await apiContext.dispose();
  });

  test("paginates the authenticated learner's courses without exposing another learner", async () => {
    const baseURL = process.env.E2E_BASE_URL ?? "";

    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "me-courses",
    });

    const organization = await organizationFixture({ kind: "brand" });

    const [firstCourse, secondCourse, otherCourse] = await Promise.all([
      courseFixture({ isPublished: true, organizationId: organization.id }),
      courseFixture({ isPublished: true, organizationId: organization.id }),
      courseFixture({ isPublished: true, organizationId: organization.id }),
    ]);

    const otherUser = await createAuthenticatedApiContext({ baseURL, prefix: "other-courses" });

    await Promise.all([
      courseUserFixture({ courseId: firstCourse.id, userId: user.id }),
      courseUserFixture({ courseId: secondCourse.id, userId: user.id }),
      courseUserFixture({ courseId: otherCourse.id, userId: otherUser.user.id }),
    ]);

    const firstResponse = await apiContext.get("/v1/me/courses?limit=1");
    expect(firstResponse.status()).toBe(200);

    const firstBody = await firstResponse.json();
    expect(firstBody.data).toHaveLength(1);
    expect(firstBody.pagination.hasMore).toBe(true);
    expect(firstBody.pagination.nextCursor).toEqual(expect.any(String));

    const secondResponse = await apiContext.get(
      `/v1/me/courses?limit=1&cursor=${firstBody.pagination.nextCursor}`,
    );

    expect(secondResponse.status()).toBe(200);

    const secondBody = await secondResponse.json();

    const returnedIds = [...firstBody.data, ...secondBody.data].map(
      (course: { id: string }) => course.id,
    );

    expect(new Set(returnedIds)).toEqual(new Set([firstCourse.id, secondCourse.id]));
    expect(returnedIds).not.toContain(otherCourse.id);
    expect(secondBody.pagination).toEqual({ hasMore: false, nextCursor: null });

    await Promise.all([apiContext.dispose(), otherUser.apiContext.dispose()]);
  });

  test("searches enrolled course titles and descriptions before paginating", async () => {
    const baseURL = process.env.E2E_BASE_URL ?? "";

    const [{ apiContext, user }, organization] = await Promise.all([
      createAuthenticatedApiContext({ baseURL, prefix: "search-my-courses" }),
      organizationFixture({ kind: "brand" }),
    ]);

    const [titleMatch, descriptionMatch, unrelated, unenrolled] = await Promise.all([
      courseFixture({ organizationId: organization.id, title: "Ocean habitats" }),
      courseFixture({
        description: "Explore ocean ecosystems",
        organizationId: null,
        title: "Marine science",
        userId: user.id,
      }),
      courseFixture({
        description: "Numbers and patterns",
        organizationId: organization.id,
        title: "Math",
      }),
      courseFixture({ organizationId: organization.id, title: "Ocean navigation" }),
    ]);

    await Promise.all([
      courseUserFixture({ courseId: titleMatch.id, userId: user.id }),
      courseUserFixture({ courseId: descriptionMatch.id, userId: user.id }),
      courseUserFixture({ courseId: unrelated.id, userId: user.id }),
    ]);

    const firstResponse = await apiContext.get("/v1/me/courses", {
      params: { limit: 1, query: "  OCEAN  " },
    });

    expect(firstResponse.status()).toBe(200);
    const firstPage = await firstResponse.json();
    expect(firstPage.data).toHaveLength(1);
    expect(firstPage.pagination.hasMore).toBe(true);

    const secondResponse = await apiContext.get("/v1/me/courses", {
      params: { cursor: firstPage.pagination.nextCursor, limit: 1, query: "ocean" },
    });

    expect(secondResponse.status()).toBe(200);
    const secondPage = await secondResponse.json();

    const courseIds = [...firstPage.data, ...secondPage.data].map(
      (course: { id: string }) => course.id,
    );

    expect(new Set(courseIds)).toEqual(new Set([titleMatch.id, descriptionMatch.id]));
    expect(courseIds).not.toContain(unenrolled.id);
    expect(secondPage.pagination).toEqual({ hasMore: false, nextCursor: null });

    const emptyResponse = await apiContext.get("/v1/me/courses", {
      params: { query: "no-matching-course" },
    });

    expect(emptyResponse.status()).toBe(200);

    expect(await emptyResponse.json()).toEqual({
      data: [],
      pagination: { hasMore: false, nextCursor: null },
    });

    const allResponse = await apiContext.get("/v1/me/courses", { params: { query: "   " } });
    expect(allResponse.status()).toBe(200);
    const allPage = await allResponse.json();
    expect(allPage.data).toHaveLength(3);
    await apiContext.dispose();
  });

  test("removes a course from the learner's library without clearing progress", async () => {
    const baseURL = process.env.E2E_BASE_URL ?? "";

    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "remove-course",
    });

    const organization = await organizationFixture({ kind: "brand" });
    const course = await courseFixture({ isPublished: true, organizationId: organization.id });
    const chapter = await chapterFixture({ courseId: course.id, organizationId: organization.id });
    const lesson = await lessonFixture({ chapterId: chapter.id, organizationId: organization.id });

    const [, lessonProgress] = await Promise.all([
      courseUserFixture({ courseId: course.id, userId: user.id }),
      lessonProgressFixture({
        completedAt: new Date(),
        durationSeconds: 60,
        lessonId: lesson.id,
        userId: user.id,
      }),
    ]);

    const response = await apiContext.delete(`/v1/me/courses/${course.id}`);

    expect(response.status()).toBe(204);

    const [courseUser, preservedProgress, updatedCourse] = await Promise.all([
      prisma.courseUser.findUnique({
        where: { courseUser: { courseId: course.id, userId: user.id } },
      }),
      prisma.lessonProgress.findUnique({ where: { id: lessonProgress.id } }),
      prisma.course.findUniqueOrThrow({ where: { id: course.id } }),
    ]);

    expect(courseUser).toBeNull();
    expect(preservedProgress).not.toBeNull();
    expect(updatedCourse.userCount).toBe(0);

    await apiContext.dispose();
  });

  test("returns the learner's bounded continuation resources", async () => {
    const baseURL = process.env.E2E_BASE_URL ?? "";

    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "continuations",
    });

    const organization = await organizationFixture({ kind: "brand" });
    const course = await courseFixture({ isPublished: true, organizationId: organization.id });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    const [completedLesson, nextLesson] = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "completed",
        isPublished: true,
        organizationId: organization.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "completed",
        isPublished: true,
        organizationId: organization.id,
        position: 1,
      }),
    ]);

    await lessonProgressFixture({
      completedAt: new Date(),
      durationSeconds: 60,
      lessonId: completedLesson.id,
      userId: user.id,
    });

    const response = await apiContext.get("/v1/me/course-continuations");

    expect(response.status()).toBe(200);

    expect(await response.json()).toEqual({
      data: [
        expect.objectContaining({
          chapter: expect.objectContaining({ id: chapter.id }),
          course: expect.objectContaining({ id: course.id }),
          lesson: expect.objectContaining({ id: nextLesson.id }),
          status: "ready",
        }),
      ],
    });

    await apiContext.dispose();
  });

  test("reads and replaces lesson visibility for the authenticated learner", async () => {
    const baseURL = process.env.E2E_BASE_URL ?? "";

    const { apiContext, token } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "lesson-visibility",
    });

    const initialResponse = await apiContext.get("/v1/me/lesson-visibility");
    expect(initialResponse.status()).toBe(200);
    expect(await initialResponse.json()).toEqual({ hiddenLessonKinds: [] });

    const updateResponse = await apiContext.patch("/v1/me/lesson-visibility", {
      data: { hiddenLessonKinds: ["quiz", "practice"] },
    });

    expect(updateResponse.status()).toBe(200);
    expect(await updateResponse.json()).toEqual({ hiddenLessonKinds: ["practice", "quiz"] });

    const organization = await organizationFixture({ kind: "brand" });
    const course = await courseFixture({ isPublished: true, organizationId: organization.id });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    const [, visibleLesson] = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "completed",
        isPublished: true,
        kind: "quiz",
        organizationId: organization.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "completed",
        isPublished: true,
        kind: "explanation",
        organizationId: organization.id,
        position: 1,
      }),
    ]);

    const [courseProgressResponse, chapterProgressResponse, nextLessonResponse] = await Promise.all(
      [
        apiContext.get(`/v1/courses/${course.id}/progress`),
        apiContext.get(`/v1/chapters/${chapter.id}/progress`),
        apiContext.get(`/v1/chapters/${chapter.id}/next-lesson`),
      ],
    );

    expect(courseProgressResponse.status()).toBe(200);

    expect(await courseProgressResponse.json()).toMatchObject({
      chapters: [{ chapterId: chapter.id, completedLessons: 0, totalLessons: 1 }],
      percentComplete: 0,
    });

    expect(chapterProgressResponse.status()).toBe(200);

    expect(await chapterProgressResponse.json()).toEqual({
      lessons: [{ isCompleted: false, lessonId: visibleLesson.id }],
      percentComplete: 0,
    });

    expect(nextLessonResponse.status()).toBe(200);

    expect(await nextLessonResponse.json()).toMatchObject({
      chapterId: chapter.id,
      courseId: course.id,
      lessonId: visibleLesson.id,
    });

    const bearerContext = await request.newContext({
      baseURL,
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    });

    const persistedResponse = await bearerContext.get("/v1/me/lesson-visibility");

    expect(persistedResponse.status()).toBe(200);
    expect(await persistedResponse.json()).toEqual({ hiddenLessonKinds: ["practice", "quiz"] });

    await Promise.all([apiContext.dispose(), bearerContext.dispose()]);
  });
});
