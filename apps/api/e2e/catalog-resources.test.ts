import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { expect, test } from "@zoonk/e2e/fixtures";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { coursePromptFixture } from "@zoonk/testing/fixtures/course-prompts";
import { courseCategoryFixture, courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture, organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { normalizeString } from "@zoonk/utils/string";

/**
 * Creates one isolated public curriculum whose IDs and search text can be used
 * across the resource-route assertions without depending on seeded content.
 */
async function createPublishedCurriculum() {
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

  const [, generationPrompt] = await Promise.all([
    courseCategoryFixture({ category: "tech", courseId: course.id }),
    coursePromptFixture({ courseId: course.id, language }),
  ]);

  const chapterTitle = `Catalog chapter ${uniqueId}`;

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    language,
    normalizedTitle: normalizeString(chapterTitle),
    organizationId: organization.id,
    position: 0,
    title: chapterTitle,
  });

  const lessonTitle = `Catalog lesson ${uniqueId}`;

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    generationStatus: "completed",
    isPublished: true,
    language,
    normalizedTitle: normalizeString(lessonTitle),
    organizationId: organization.id,
    position: 0,
    title: lessonTitle,
  });

  return { chapter, course, generationPrompt, language, lesson, organization, uniqueId };
}

test.describe("Catalog resource API", () => {
  test("browses published courses by language and category without a search query", async () => {
    const { course, language } = await createPublishedCurriculum();

    const otherCourse = await courseFixture({
      isPublished: true,
      language,
      organizationId: course.organizationId,
      userCount: 100,
    });

    await courseCategoryFixture({ category: "science", courseId: otherCourse.id });

    const apiContext = await request.newContext({ baseURL: process.env.E2E_BASE_URL });

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
    const { course, language, organization } = await createPublishedCurriculum();

    const additionalCourses = await Promise.all([
      courseFixture({ isPublished: true, language, organizationId: organization.id, userCount: 9 }),
      courseFixture({ isPublished: true, language, organizationId: organization.id, userCount: 8 }),
    ]);

    const apiContext = await request.newContext({ baseURL: process.env.E2E_BASE_URL });
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
    const apiContext = await request.newContext({ baseURL: process.env.E2E_BASE_URL });
    const response = await apiContext.get("/v1/courses?language=en&cursor=not-a-cursor");

    expect(response.status()).toBe(400);

    await apiContext.dispose();
  });

  test("rejects the removed legacy course query parameter", async () => {
    const apiContext = await request.newContext({ baseURL: process.env.E2E_BASE_URL });
    const response = await apiContext.get("/v1/courses?language=en&query=legacy");

    expect(response.status()).toBe(400);

    await apiContext.dispose();
  });

  test("searches courses and chapters through one bounded catalog resource", async () => {
    const { chapter, course, language, uniqueId } = await createPublishedCurriculum();
    const apiContext = await request.newContext({ baseURL: process.env.E2E_BASE_URL });

    const response = await apiContext.get(
      `/v1/catalog/search?query=${uniqueId}&language=${language}`,
    );

    expect(response.status()).toBe(200);

    const body = await response.json();

    expect(body.courses).toEqual([
      expect.objectContaining({ id: course.id, organizationSlug: expect.any(String) }),
    ]);

    expect(body.chapters).toEqual([
      expect.objectContaining({ courseId: course.id, id: chapter.id }),
    ]);

    await apiContext.dispose();
  });

  test("lists the finite completed language-course collection", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const organization = await aiOrganizationFixture();

    const course = await courseFixture({
      format: "language",
      generationStatus: "completed",
      isPublished: true,
      language: uniqueId,
      organizationId: organization.id,
      targetLanguage: "es",
    });

    const apiContext = await request.newContext({ baseURL: process.env.E2E_BASE_URL });
    const response = await apiContext.get(`/v1/language-courses?language=${uniqueId}`);

    expect(response.status()).toBe(200);

    expect(await response.json()).toEqual({
      data: [expect.objectContaining({ id: course.id, targetLanguage: "es" })],
    });

    await apiContext.dispose();
  });

  test("returns intentional course, chapter, and lesson resources", async () => {
    const { chapter, course, generationPrompt, lesson, organization } =
      await createPublishedCurriculum();

    const apiContext = await request.newContext({ baseURL: process.env.E2E_BASE_URL });

    const [courseResponse, chaptersResponse, chapterResponse, lessonsResponse, lessonResponse] =
      await Promise.all([
        apiContext.get(`/v1/courses/${course.id}`),
        apiContext.get(`/v1/courses/${course.id}/chapters`),
        apiContext.get(`/v1/chapters/${chapter.id}`),
        apiContext.get(`/v1/chapters/${chapter.id}/lessons`),
        apiContext.get(`/v1/lessons/${lesson.id}`),
      ]);

    expect(courseResponse.status()).toBe(200);
    expect(chaptersResponse.status()).toBe(200);
    expect(chapterResponse.status()).toBe(200);
    expect(lessonsResponse.status()).toBe(200);
    expect(lessonResponse.status()).toBe(200);

    await expect(courseResponse.json()).resolves.toEqual({
      categories: ["tech"],
      coursePromptId: generationPrompt.id,
      description: course.description,
      format: course.format,
      generationId: course.generationRunId,
      generationStatus: course.generationStatus,
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

    await expect(chaptersResponse.json()).resolves.toMatchObject({
      data: [
        {
          courseId: course.id,
          generationId: chapter.generationRunId,
          generationStatus: chapter.generationStatus,
          id: chapter.id,
          lessonCount: 1,
          position: 0,
          title: chapter.title,
        },
      ],
    });

    await expect(chapterResponse.json()).resolves.toMatchObject({
      courseId: course.id,
      generationId: chapter.generationRunId,
      generationStatus: chapter.generationStatus,
      id: chapter.id,
      position: chapter.position,
      title: chapter.title,
    });

    await expect(lessonsResponse.json()).resolves.toMatchObject({
      data: [
        {
          chapterId: chapter.id,
          generationId: lesson.generationRunId,
          generationStatus: lesson.generationStatus,
          id: lesson.id,
          kind: lesson.kind,
          position: lesson.position,
          title: lesson.title,
        },
      ],
    });

    await expect(lessonResponse.json()).resolves.toMatchObject({
      chapterId: chapter.id,
      courseId: course.id,
      generationId: lesson.generationRunId,
      generationStatus: lesson.generationStatus,
      id: lesson.id,
      kind: lesson.kind,
      position: lesson.position,
      title: lesson.title,
    });

    await apiContext.dispose();
  });

  test("returns every course chapter and chapter lesson without pagination", async () => {
    const { chapter, course, language, organization } = await createPublishedCurriculum();
    const additionalItemCount = 20;

    await Promise.all([
      ...Array.from({ length: additionalItemCount }, (_, index) =>
        chapterFixture({
          courseId: course.id,
          isPublished: true,
          language,
          organizationId: organization.id,
          position: index + 1,
        }),
      ),
      ...Array.from({ length: additionalItemCount }, (_, index) =>
        lessonFixture({
          chapterId: chapter.id,
          generationStatus: "completed",
          isPublished: true,
          language,
          organizationId: organization.id,
          position: index + 1,
        }),
      ),
    ]);

    const apiContext = await request.newContext({ baseURL: process.env.E2E_BASE_URL });

    const [chaptersResponse, lessonsResponse] = await Promise.all([
      apiContext.get(`/v1/courses/${course.id}/chapters`),
      apiContext.get(`/v1/chapters/${chapter.id}/lessons`),
    ]);

    expect(chaptersResponse.status()).toBe(200);
    expect(lessonsResponse.status()).toBe(200);

    const [chapters, lessons] = await Promise.all([
      chaptersResponse.json(),
      lessonsResponse.json(),
    ]);

    expect(Object.keys(chapters)).toStrictEqual(["data"]);
    expect(Object.keys(lessons)).toStrictEqual(["data"]);
    expect(chapters.data).toHaveLength(additionalItemCount + 1);
    expect(lessons.data).toHaveLength(additionalItemCount + 1);

    expect(chapters.data.map((item: { position: number }) => item.position)).toStrictEqual(
      Array.from({ length: additionalItemCount + 1 }, (_, index) => index),
    );

    expect(lessons.data.map((item: { position: number }) => item.position)).toStrictEqual(
      Array.from({ length: additionalItemCount + 1 }, (_, index) => index),
    );

    await apiContext.dispose();
  });

  test("does not expose unpublished resources through direct IDs", async () => {
    const organization = await organizationFixture({ kind: "brand" });

    const [publishedCourse, unpublishedCourse] = await Promise.all([
      courseFixture({ isPublished: true, organizationId: organization.id }),
      courseFixture({ isPublished: false, organizationId: organization.id }),
    ]);

    const unpublishedChapter = await chapterFixture({
      courseId: publishedCourse.id,
      isPublished: false,
      organizationId: organization.id,
    });

    const publishedLesson = await lessonFixture({
      chapterId: unpublishedChapter.id,
      generationStatus: "completed",
      isPublished: true,
      organizationId: organization.id,
    });

    const apiContext = await request.newContext({ baseURL: process.env.E2E_BASE_URL });

    const [courseResponse, chapterResponse, lessonResponse] = await Promise.all([
      apiContext.get(`/v1/courses/${unpublishedCourse.id}`),
      apiContext.get(`/v1/chapters/${unpublishedChapter.id}`),
      apiContext.get(`/v1/lessons/${publishedLesson.id}`),
    ]);

    const responses = [courseResponse, chapterResponse, lessonResponse];
    const responseBodies = await Promise.all(responses.map((response) => response.json()));

    expect(responses.map((response) => response.status())).toStrictEqual([404, 404, 404]);

    for (const responseBody of responseBodies) {
      expect(responseBody).toMatchObject({ error: { code: "NOT_FOUND" } });
    }

    await apiContext.dispose();
  });
});
