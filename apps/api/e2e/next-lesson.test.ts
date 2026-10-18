import { type APIRequestContext, request } from "@playwright/test";
import { expect, test } from "@zoonk/e2e/fixtures";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import {
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import { catalogCourseFixture } from "@zoonk/testing/fixtures/library-courses";
import { createAuthenticatedApiContext } from "./helpers/auth";

const baseURL = process.env.E2E_BASE_URL ?? "";

function newApiContext(): Promise<APIRequestContext> {
  return request.newContext({ baseURL });
}

test.describe("Next Lesson API", () => {
  test("starts a visitor at the course's first lesson", async () => {
    const { chapters, course, lessons, organization } = await catalogCourseFixture({
      lessonCounts: [2],
    });

    const apiContext = await newApiContext();
    const response = await apiContext.get(`/v1/courses/${course.id}/next-lesson`);

    expect(response.status()).toBe(200);

    await expect(response.json()).resolves.toEqual({
      canPrefetch: true,
      chapterId: chapters[0]!.id,
      chapterSlug: chapters[0]!.slug,
      completed: false,
      courseId: course.id,
      courseSlug: course.slug,
      hasStarted: false,
      lessonId: lessons[0]![0]!.id,
      lessonPosition: 0,
      lessonSlug: lessons[0]![0]!.slug,
      organizationSlug: organization.slug,
      type: "lesson",
    });

    await apiContext.dispose();
  });

  test("continues after the lessons the learner finished", async () => {
    const [{ apiContext, user }, { chapters, course, lessons }] = await Promise.all([
      createAuthenticatedApiContext({ baseURL, prefix: "next-lesson" }),
      catalogCourseFixture({ lessonCounts: [2, 1] }),
    ]);

    await learningEventFixture({ contentIds: { lessonId: lessons[0]![0]!.id }, userId: user.id });

    const [courseResponse, chapterResponse] = await Promise.all([
      apiContext.get(`/v1/courses/${course.id}/next-lesson`),
      apiContext.get(`/v1/chapters/${chapters[1]!.id}/next-lesson`),
    ]);

    await expect(courseResponse.json()).resolves.toMatchObject({
      completed: false,
      hasStarted: true,
      lessonId: lessons[0]![1]!.id,
      lessonPosition: 1,
      type: "lesson",
    });

    await expect(chapterResponse.json()).resolves.toMatchObject({
      chapterId: chapters[1]!.id,
      hasStarted: false,
      lessonId: lessons[1]![0]!.id,
      type: "lesson",
    });

    await apiContext.dispose();
  });

  test("points at the next chapter while its lessons aren't written", async () => {
    const [{ apiContext, user }, { course, lessons }] = await Promise.all([
      createAuthenticatedApiContext({ baseURL, prefix: "next-chapter" }),
      catalogCourseFixture({ lessonCounts: [1] }),
    ]);

    const pending = await libraryChapterFixture({ homeCourseId: course.id });

    await Promise.all([
      courseChapterFixture({ chapterId: pending.id, courseId: course.id, position: 1 }),
      learningEventFixture({ contentIds: { lessonId: lessons[0]![0]!.id }, userId: user.id }),
    ]);

    const [courseResponse, chapterResponse] = await Promise.all([
      apiContext.get(`/v1/courses/${course.id}/next-lesson`),
      apiContext.get(`/v1/chapters/${pending.id}/next-lesson`),
    ]);

    await expect(courseResponse.json()).resolves.toMatchObject({
      canPrefetch: false,
      chapterId: pending.id,
      chapterSlug: pending.slug,
      completed: false,
      hasStarted: true,
      type: "chapter",
    });

    await expect(chapterResponse.json()).resolves.toEqual({
      completed: false,
      hasStarted: false,
      type: "empty",
    });

    await apiContext.dispose();
  });

  test("reads a shared chapter's next lesson in the course named by courseId", async () => {
    const [home, other, unrelated] = await Promise.all([
      catalogCourseFixture({ lessonCounts: [1] }),
      catalogCourseFixture({ lessonCounts: [] }),
      catalogCourseFixture({ lessonCounts: [] }),
    ]);

    const chapter = home.chapters[0]!;

    await courseChapterFixture({ chapterId: chapter.id, courseId: other.course.id });

    const apiContext = await newApiContext();

    const [inOther, inUnrelated] = await Promise.all([
      apiContext.get(`/v1/chapters/${chapter.id}/next-lesson?courseId=${other.course.id}`),
      apiContext.get(`/v1/chapters/${chapter.id}/next-lesson?courseId=${unrelated.course.id}`),
    ]);

    await expect(inOther.json()).resolves.toMatchObject({
      courseId: other.course.id,
      courseSlug: other.course.slug,
      lessonId: home.lessons[0]![0]!.id,
      organizationSlug: other.organization.slug,
    });

    expect(inUnrelated.status()).toBe(404);

    await apiContext.dispose();
  });

  test("returns an empty target for a course without chapters", async () => {
    const { course } = await catalogCourseFixture({ lessonCounts: [] });
    const apiContext = await newApiContext();
    const response = await apiContext.get(`/v1/courses/${course.id}/next-lesson`);

    expect(response.status()).toBe(200);

    await expect(response.json()).resolves.toEqual({
      completed: false,
      hasStarted: false,
      type: "empty",
    });

    await apiContext.dispose();
  });
});
