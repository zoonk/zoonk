import { randomUUID } from "node:crypto";
import { type APIRequestContext, request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { courseCategoryFixture, courseFixture } from "@zoonk/testing/fixtures/courses";
import {
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import {
  catalogCourseFixture,
  privateCourseFixture,
} from "@zoonk/testing/fixtures/library-courses";
import {
  chapterLessonFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { normalizeString } from "@zoonk/utils/string";
import { createAuthenticatedApiContext } from "./helpers/auth";

const baseURL = process.env.E2E_BASE_URL ?? "";

function newApiContext(): Promise<APIRequestContext> {
  return request.newContext({ baseURL });
}

function getAll({ apiContext, paths }: { apiContext: APIRequestContext; paths: string[] }) {
  return Promise.all(paths.map((path) => apiContext.get(path)));
}

/**
 * Creates one isolated published course in a language of its own, so collection
 * and search assertions don't depend on seeded content.
 */
async function createLanguageCourse() {
  const uniqueId = randomUUID().slice(0, 8);
  const language = uniqueId;
  const organization = await organizationFixture({ kind: "brand" });
  const courseTitle = `Catalog course ${uniqueId}`;

  const course = await courseFixture({
    isPublished: true,
    language,
    normalizedTitle: normalizeString(courseTitle),
    organizationId: organization.id,
    title: courseTitle,
    userCount: 10,
  });

  await courseCategoryFixture({ category: "tech", courseId: course.id });

  return { course, language, organization, uniqueId };
}

test.describe("Catalog resource API", () => {
  test("browses published courses by language and category without a search query", async () => {
    const { course, language } = await createLanguageCourse();

    const otherCourse = await courseFixture({
      isPublished: true,
      language,
      organizationId: course.organizationId,
      userCount: 100,
    });

    await courseCategoryFixture({ category: "science", courseId: otherCourse.id });

    const apiContext = await newApiContext();

    const response = await apiContext.get(
      `/v1/courses?language=${language}&category=tech&limit=10`,
    );

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({ id: course.id, language, title: course.title });
    expect(body.pagination).toEqual({ hasMore: false, nextCursor: null });

    await apiContext.dispose();
  });

  test("paginates the published course collection without repeating courses", async () => {
    const { course, language, organization } = await createLanguageCourse();

    const additionalCourses = await Promise.all([
      courseFixture({ isPublished: true, language, organizationId: organization.id, userCount: 9 }),
      courseFixture({ isPublished: true, language, organizationId: organization.id, userCount: 8 }),
    ]);

    const apiContext = await newApiContext();
    const firstResponse = await apiContext.get(`/v1/courses?language=${language}&limit=2`);

    expect(firstResponse.status()).toBe(200);

    const firstPage = await firstResponse.json();

    expect(firstPage.data).toHaveLength(2);
    expect(firstPage.pagination).toEqual({ hasMore: true, nextCursor: expect.any(String) });

    const secondResponse = await apiContext.get(
      `/v1/courses?language=${language}&limit=2&cursor=${firstPage.pagination.nextCursor}`,
    );

    expect(secondResponse.status()).toBe(200);

    const secondPage = await secondResponse.json();

    const returnedIds = [...firstPage.data, ...secondPage.data].map(
      (returnedCourse: { id: string }) => returnedCourse.id,
    );

    expect(secondPage.data).toHaveLength(1);
    expect(secondPage.pagination).toEqual({ hasMore: false, nextCursor: null });

    expect(new Set(returnedIds)).toEqual(
      new Set([course.id, ...additionalCourses.map((additionalCourse) => additionalCourse.id)]),
    );

    await apiContext.dispose();
  });

  test("rejects a malformed course pagination cursor", async () => {
    const apiContext = await newApiContext();
    const response = await apiContext.get("/v1/courses?language=en&cursor=not-a-cursor");

    expect(response.status()).toBe(400);

    await apiContext.dispose();
  });

  test("rejects the removed legacy course query parameter", async () => {
    const apiContext = await newApiContext();
    const response = await apiContext.get("/v1/courses?language=en&query=legacy");

    expect(response.status()).toBe(400);

    await apiContext.dispose();
  });

  test("searches courses and Library chapters through one bounded catalog resource", async () => {
    const [{ course, language, organization, uniqueId }, owner] = await Promise.all([
      createLanguageCourse(),
      userFixture(),
    ]);

    const chapterTitle = `Catalog chapter ${uniqueId}`;

    const [chapter] = await Promise.all([
      libraryChapterFixture({
        homeCourseId: course.id,
        language,
        normalizedTitle: normalizeString(chapterTitle),
        title: chapterTitle,
      }),
      libraryChapterFixture({
        language,
        normalizedTitle: normalizeString(chapterTitle),
        ownerId: owner.id,
        title: chapterTitle,
        visibility: "private",
      }),
    ]);

    const apiContext = await newApiContext();

    const response = await apiContext.get(
      `/v1/catalog/search?query=${uniqueId}&language=${language}`,
    );

    expect(response.status()).toBe(200);

    const body = await response.json();

    expect(body.courses).toEqual([
      expect.objectContaining({
        id: course.id,
        organizationSlug: organization.slug,
        targetLanguage: null,
      }),
    ]);

    expect(body.chapters).toEqual([
      {
        courseId: course.id,
        courseSlug: course.slug,
        courseTitle: course.title,
        description: chapter.description,
        id: chapter.id,
        language,
        organizationSlug: organization.slug,
        slug: chapter.slug,
        title: chapterTitle,
      },
    ]);

    await apiContext.dispose();
  });

  test("returns course, chapter, and lesson resources from the Library outline", async () => {
    const { chapters, course, lessons, organization } = await catalogCourseFixture({
      lessonCounts: [1, 2],
      outlineRunId: `outline-${randomUUID()}`,
    });

    await courseCategoryFixture({ category: "tech", courseId: course.id });

    const chapter = chapters[1]!;
    const lesson = lessons[1]![1]!;
    const apiContext = await newApiContext();

    const [courseResponse, chaptersResponse, chapterResponse, lessonsResponse] = await Promise.all([
      apiContext.get(`/v1/courses/${course.id}`),
      apiContext.get(`/v1/courses/${course.id}/chapters`),
      apiContext.get(`/v1/chapters/${chapter.id}`),
      apiContext.get(`/v1/chapters/${chapter.id}/lessons`),
    ]);

    expect(courseResponse.status()).toBe(200);
    expect(chaptersResponse.status()).toBe(200);
    expect(chapterResponse.status()).toBe(200);
    expect(lessonsResponse.status()).toBe(200);

    await expect(courseResponse.json()).resolves.toEqual({
      categories: ["tech"],
      description: course.description,
      format: course.format,
      generationId: course.outlineRunId,
      generationStatus: "completed",
      id: course.id,
      imageUrl: course.imageUrl,
      language: course.language,
      organization: {
        id: organization.id,
        logo: organization.logo,
        name: organization.name,
        slug: organization.slug,
      },
      slug: course.slug,
      targetLanguage: course.targetLanguage,
      title: course.title,
    });

    const chapterResource = {
      courseId: course.id,
      description: chapter.description,
      generationId: chapter.outlineRunId,
      generationStatus: "completed",
      id: chapter.id,
      language: chapter.language,
      level: "beginner",
      position: 1,
      slug: chapter.slug,
      title: chapter.title,
    };

    const chaptersBody = await chaptersResponse.json();

    expect(chaptersBody.data).toHaveLength(2);
    expect(chaptersBody.data[1]).toEqual({ ...chapterResource, lessonCount: 2 });
    await expect(chapterResponse.json()).resolves.toEqual(chapterResource);

    const lessonsBody = await lessonsResponse.json();

    expect(lessonsBody.data).toHaveLength(2);

    expect(lessonsBody.data[1]).toEqual({
      chapterId: chapter.id,
      courseId: course.id,
      description: lesson.description,
      generationId: lesson.contentRunId,
      generationStatus: "completed",
      id: lesson.id,
      language: lesson.language,
      position: 1,
      slug: lesson.slug,
      title: lesson.title,
    });

    await apiContext.dispose();
  });

  test("gives a cover the web app serves its absolute address, which a native client can load", async () => {
    const { course, language } = await createLanguageCourse();
    const cover = "/catalog/chapters/science.webp";

    await prisma.course.update({ data: { imageUrl: cover }, where: { id: course.id } });

    const apiContext = await newApiContext();

    const [courseResponse, listResponse] = await Promise.all([
      apiContext.get(`/v1/courses/${course.id}`),
      apiContext.get(`/v1/courses?language=${language}`),
    ]);

    const absoluteCover = /^https?:\/\/[^/]+\/catalog\/chapters\/science\.webp$/u;

    await expect(courseResponse.json()).resolves.toMatchObject({
      imageUrl: expect.stringMatching(absoluteCover),
    });

    await expect(listResponse.json()).resolves.toMatchObject({
      data: [{ id: course.id, imageUrl: expect.stringMatching(absoluteCover) }],
    });

    await apiContext.dispose();
  });

  test("reads a shared chapter in the course named by courseId", async () => {
    const [home, other, unrelated] = await Promise.all([
      catalogCourseFixture({ lessonCounts: [1] }),
      catalogCourseFixture({ lessonCounts: [1] }),
      catalogCourseFixture({ lessonCounts: [1] }),
    ]);

    const shared = home.chapters[0]!;

    await courseChapterFixture({
      chapterId: shared.id,
      courseId: other.course.id,
      level: "advanced",
      position: 0,
    });

    const apiContext = await newApiContext();

    const [chapterResponse, lessonsResponse, unrelatedResponse, invalidResponse] =
      await Promise.all([
        apiContext.get(`/v1/chapters/${shared.id}?courseId=${other.course.id}`),
        apiContext.get(`/v1/chapters/${shared.id}/lessons?courseId=${other.course.id}`),
        apiContext.get(`/v1/chapters/${shared.id}/lessons?courseId=${unrelated.course.id}`),
        apiContext.get(`/v1/chapters/${shared.id}?courseId=not-a-uuid`),
      ]);

    expect(chapterResponse.status()).toBe(200);

    await expect(chapterResponse.json()).resolves.toMatchObject({
      courseId: other.course.id,
      id: shared.id,
      level: "advanced",
      position: 1,
    });

    expect(lessonsResponse.status()).toBe(200);

    await expect(lessonsResponse.json()).resolves.toEqual({
      data: [
        expect.objectContaining({
          chapterId: shared.id,
          courseId: other.course.id,
          id: home.lessons[0]![0]!.id,
        }),
      ],
    });

    expect(unrelatedResponse.status()).toBe(404);
    expect(invalidResponse.status()).toBe(400);

    await apiContext.dispose();
  });

  test("hides private chapters and lessons from visitors", async () => {
    const [owner, { chapters, course }] = await Promise.all([
      userFixture(),
      catalogCourseFixture({ lessonCounts: [1] }),
    ]);

    const [privateChapter, privateLesson] = await Promise.all([
      libraryChapterFixture({ homeCourseId: course.id, ownerId: owner.id, visibility: "private" }),
      libraryLessonFixture({ ownerId: owner.id, visibility: "private" }),
    ]);

    await Promise.all([
      courseChapterFixture({ chapterId: privateChapter.id, courseId: course.id, position: 1 }),
      chapterLessonFixture({ chapterId: chapters[0]!.id, lessonId: privateLesson.id, position: 1 }),
    ]);

    const apiContext = await newApiContext();

    const [chaptersResponse, chapterResponse, lessonsResponse] = await Promise.all([
      apiContext.get(`/v1/courses/${course.id}/chapters`),
      apiContext.get(`/v1/chapters/${privateChapter.id}`),
      apiContext.get(`/v1/chapters/${chapters[0]!.id}/lessons`),
    ]);

    const [chapterPage, lessonPage] = await Promise.all([
      chaptersResponse.json(),
      lessonsResponse.json(),
    ]);

    const chapterIds = chapterPage.data.map((item: { id: string }) => item.id);
    const lessonIds = lessonPage.data.map((item: { id: string }) => item.id);

    expect(chapterIds).toStrictEqual([chapters[0]!.id]);
    expect(chapterResponse.status()).toBe(404);
    expect(lessonIds).not.toContain(privateLesson.id);
    expect(lessonIds).toHaveLength(1);

    await apiContext.dispose();
  });

  test("returns every course chapter and chapter lesson without pagination", async () => {
    const itemCount = 21;

    const { chapters, course } = await catalogCourseFixture({
      lessonCounts: [itemCount, ...Array.from({ length: itemCount - 1 }, () => 0)],
    });

    const apiContext = await newApiContext();

    const [chaptersResponse, lessonsResponse] = await Promise.all([
      apiContext.get(`/v1/courses/${course.id}/chapters`),
      apiContext.get(`/v1/chapters/${chapters[0]!.id}/lessons`),
    ]);

    expect(chaptersResponse.status()).toBe(200);
    expect(lessonsResponse.status()).toBe(200);

    const [chapterPage, lessonPage] = await Promise.all([
      chaptersResponse.json(),
      lessonsResponse.json(),
    ]);

    expect(Object.keys(chapterPage)).toStrictEqual(["data"]);
    expect(Object.keys(lessonPage)).toStrictEqual(["data"]);

    const positions = Array.from({ length: itemCount }, (_, index) => index);

    expect(chapterPage.data.map((item: { position: number }) => item.position)).toStrictEqual(
      positions,
    );

    expect(lessonPage.data.map((item: { position: number }) => item.position)).toStrictEqual(
      positions,
    );

    await apiContext.dispose();
  });

  test("serves a learner's private course, its chapters and lessons to that learner only", async () => {
    const [owner, other, visitor] = await Promise.all([
      createAuthenticatedApiContext({ baseURL, prefix: "private-course-owner" }),
      createAuthenticatedApiContext({ baseURL, prefix: "private-course-other" }),
      newApiContext(),
    ]);

    const { chapters, course, lessons } = await privateCourseFixture({
      lessonCounts: [1],
      ownerId: owner.user.id,
    });

    const chapter = chapters[0]!;

    const paths = [
      `/v1/courses/${course.id}`,
      `/v1/courses/${course.id}/chapters`,
      `/v1/chapters/${chapter.id}`,
      `/v1/chapters/${chapter.id}/lessons`,
    ];

    const [ownerResponses, otherResponses, visitorResponses] = await Promise.all([
      getAll({ apiContext: owner.apiContext, paths }),
      getAll({ apiContext: other.apiContext, paths }),
      getAll({ apiContext: visitor, paths }),
    ]);

    expect(ownerResponses.map((response) => response.status())).toStrictEqual([200, 200, 200, 200]);
    expect(otherResponses.map((response) => response.status())).toStrictEqual([404, 404, 404, 404]);

    expect(visitorResponses.map((response) => response.status())).toStrictEqual([
      404, 404, 404, 404,
    ]);

    const [courseBody, chaptersBody, chapterBody, lessonsBody] = await Promise.all(
      ownerResponses.map((response) => response.json()),
    );

    expect(courseBody).toMatchObject({
      categories: [],
      generationStatus: "completed",
      id: course.id,
      organization: null,
      slug: course.slug,
      title: course.title,
    });

    expect(chaptersBody.data).toEqual([
      expect.objectContaining({ courseId: course.id, id: chapter.id, lessonCount: 1, position: 0 }),
    ]);

    expect(chapterBody).toMatchObject({ courseId: course.id, id: chapter.id, level: "beginner" });

    expect(lessonsBody.data).toEqual([
      expect.objectContaining({
        chapterId: chapter.id,
        courseId: course.id,
        id: lessons[0]![0]!.id,
      }),
    ]);

    await Promise.all([owner.apiContext.dispose(), other.apiContext.dispose(), visitor.dispose()]);
  });

  test("does not expose courses outside the published brand catalog", async () => {
    const organization = await organizationFixture({ kind: "brand" });

    const unpublished = await courseFixture({
      isPublished: false,
      organizationId: organization.id,
    });

    const chapter = await libraryChapterFixture({ homeCourseId: unpublished.id });

    await courseChapterFixture({ chapterId: chapter.id, courseId: unpublished.id });

    const apiContext = await newApiContext();

    const responses = await Promise.all([
      apiContext.get(`/v1/courses/${unpublished.id}`),
      apiContext.get(`/v1/courses/${unpublished.id}/chapters`),
      apiContext.get(`/v1/chapters/${chapter.id}`),
      apiContext.get(`/v1/chapters/${chapter.id}/lessons`),
      apiContext.get(`/v1/chapters/${randomUUID()}`),
    ]);

    const bodies = await Promise.all(responses.map((response) => response.json()));

    expect(responses.map((response) => response.status())).toStrictEqual([404, 404, 404, 404, 404]);

    for (const body of bodies) {
      expect(body).toMatchObject({ error: { code: "NOT_FOUND" } });
    }

    await apiContext.dispose();
  });
});
