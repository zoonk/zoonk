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
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { normalizeString } from "@zoonk/utils/string";
import {
  catalogLessonSchema,
  chapterResourceSchema,
  courseResourceSchema,
} from "../src/lib/openapi/schemas/catalog-resources";
import { createAuthenticatedApiContext } from "./helpers/auth";
import { readBody } from "./helpers/response";

const baseURL = process.env.E2E_BASE_URL ?? "";

function newApiContext(): Promise<APIRequestContext> {
  return request.newContext({ baseURL });
}

function getAll({ apiContext, paths }: { apiContext: APIRequestContext; paths: string[] }) {
  return Promise.all(paths.map((path) => apiContext.get(path)));
}

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

function examDateAfter(days: number) {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

function examEdition(dates: string[], timeZone = "America/Sao_Paulo") {
  return {
    check: null,
    citations: [],
    dates: dates.map((value) => ({
      citation: { passage: "Exam day", sourceId: "notice" },
      date: value,
      kind: "exam",
      label: "Exam",
      startTime: null,
    })),
    noticeUrl: null,
    questionCount: null,
    sourceHash: null,
    timeZone,
    year: Number(dates[0]?.slice(0, 4)),
  };
}

test.describe("Catalog resource API", () => {
  test("course detail exposes upcoming exam days and reads revised notice dates without a stale cache", async () => {
    const [organization, apiContext] = await Promise.all([
      organizationFixture({ kind: "brand" }),
      newApiContext(),
    ]);

    const course = await courseFixture({
      format: "exam",
      isPublished: true,
      organizationId: organization.id,
    });

    const days = [examDateAfter(21), examDateAfter(28)];
    const blueprint = await examBlueprintFixture({ edition: examEdition(days.toReversed()) });

    await prisma.examSkillGraph.create({
      data: {
        examBlueprintId: blueprint.id,
        generatedAt: new Date(),
        graph: { phases: [], skills: [] },
        model: "fixture",
        primaryCourseId: course.id,
        promptVersion: "fixture",
        runId: "fixture",
      },
    });

    const first = await readBody({
      response: await apiContext.get(`/v1/courses/${course.id}`),
      schema: courseResourceSchema,
    });

    expect(first.exam).toStrictEqual({ days, estimated: false, timeZone: "America/Sao_Paulo" });

    const revised = [examDateAfter(35), examDateAfter(42)];

    await prisma.examBlueprint.update({
      data: { edition: examEdition(revised, "Asia/Tokyo") },
      where: { id: blueprint.id },
    });

    const second = await readBody({
      response: await apiContext.get(`/v1/courses/${course.id}`),
      schema: courseResourceSchema,
    });

    expect(second.exam).toStrictEqual({ days: revised, estimated: false, timeZone: "Asia/Tokyo" });

    const ordinary = await courseFixture({ isPublished: true, organizationId: organization.id });

    const withoutExam = await readBody({
      response: await apiContext.get(`/v1/courses/${ordinary.id}`),
      schema: courseResourceSchema,
    });

    expect(withoutExam.exam).toBeNull();
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
    const { chapters, course, lessons } = await catalogCourseFixture({
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

    const chaptersBody = await chaptersResponse.json();

    expect(chaptersBody.data).toHaveLength(2);

    expect(chaptersBody.data[1]).toMatchObject({
      courseId: course.id,
      id: chapter.id,
      lessons: lessons[1]!.map((item) => ({
        estimatedMinutes: item.estimatedMinutes,
        id: item.id,
        slug: item.slug,
        title: item.title,
      })),
      objectives: chapter.objectives,
    });

    await expect(chapterResponse.json()).resolves.toMatchObject({
      courseId: course.id,
      id: chapter.id,
    });

    const lessonsBody = await lessonsResponse.json();

    expect(lessonsBody.data).toHaveLength(2);

    expect(lessonsBody.data[1]).toMatchObject({
      chapterId: chapter.id,
      courseId: course.id,
      estimatedMinutes: lesson.estimatedMinutes,
      id: lesson.id,
    });

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

  test("shows visitors a lesson's public page and each page's lesson to try, never the answers", async () => {
    const [{ chapters, course, lessons }, unpublished, owner] = await Promise.all([
      catalogCourseFixture({ lessonCounts: [1, 1] }),
      catalogCourseFixture({ isPublished: false, lessonCounts: [1] }),
      userFixture(),
    ]);

    const [[told] = [], [guessed] = []] = lessons;

    const guessHook = {
      options: [
        { id: "planet", isCorrect: false, text: "Yes, like a tiny planet" },
        { id: "cloud", isCorrect: true, text: "No, it's more like a cloud" },
      ],
      question: "Does the electron circle the nucleus?",
      reveal: "It's a cloud of chances.",
      variant: "guess",
    };

    const [privateLesson] = await Promise.all([
      libraryLessonFixture({
        contentStatus: "completed",
        ownerId: owner.id,
        visibility: "private",
      }),
      libraryStepFixture({
        content: { text: "Atoms are mostly empty.", variant: "text" },
        kind: "hook",
        lessonId: told!.id,
        position: 0,
      }),
      libraryStepFixture({ content: guessHook, kind: "hook", lessonId: guessed!.id, position: 0 }),
      prisma.lesson.update({
        data: { summary: { ideas: [{ text: "The electron is a cloud." }] } },
        where: { id: guessed!.id },
      }),
    ]);

    const apiContext = await newApiContext();

    const [courseResponse, lessonResponse, firstChapter, secondChapter, textLesson, responses] =
      await Promise.all([
        apiContext.get(`/v1/courses/${course.id}`),
        apiContext.get(`/v1/catalog/lessons/${guessed!.id}?courseId=${course.id}`),
        apiContext
          .get(`/v1/chapters/${chapters[0]!.id}`)
          .then((response) => readBody({ response, schema: chapterResourceSchema })),
        apiContext
          .get(`/v1/chapters/${chapters[1]!.id}`)
          .then((response) => readBody({ response, schema: chapterResourceSchema })),
        apiContext
          .get(`/v1/catalog/lessons/${told!.id}?courseId=${course.id}`)
          .then((response) => readBody({ response, schema: catalogLessonSchema })),
        getAll({
          apiContext,
          paths: [
            `/v1/catalog/lessons/${privateLesson.id}?courseId=${course.id}`,
            `/v1/catalog/lessons/${randomUUID()}?courseId=${course.id}`,
            `/v1/catalog/lessons/${guessed!.id}?courseId=${unpublished.course.id}`,
            `/v1/catalog/lessons/${unpublished.lessons[0]![0]!.id}?courseId=${unpublished.course.id}`,
          ],
        }),
      ]);

    const [rawCourse, rawLesson] = await Promise.all([
      courseResponse.text(),
      lessonResponse.text(),
    ]);

    const courseBody = courseResourceSchema.parse(JSON.parse(rawCourse));
    const lesson = catalogLessonSchema.parse(JSON.parse(rawLesson));

    const screen = {
      context: null,
      guess: true,
      kind: "choice",
      options: [
        { id: "planet", text: "Yes, like a tiny planet" },
        { id: "cloud", text: "No, it's more like a cloud" },
      ],
      question: guessHook.question,
    };

    const tryLesson = {
      chapterTitle: chapters[1]!.title,
      lessonId: guessed!.id,
      minutes: guessed!.estimatedMinutes,
      number: 1,
      screen,
    };

    expect(courseBody.tryLesson).toStrictEqual(tryLesson);
    expect(secondChapter.tryLesson).toStrictEqual(tryLesson);
    expect(firstChapter.tryLesson).toBeNull();

    expect(lesson).toStrictEqual({
      description: guessed!.description,
      estimatedMinutes: guessed!.estimatedMinutes,
      firstScreen: screen,
      id: guessed!.id,
      language: guessed!.language,
      summaryIdeas: ["The electron is a cloud."],
      title: guessed!.title,
    });

    expect(textLesson.firstScreen).toStrictEqual({ kind: "text", text: "Atoms are mostly empty." });
    expect(courseResponse.status()).toBe(200);
    expect(lessonResponse.status()).toBe(200);
    expect(rawCourse + rawLesson).not.toMatch(/isCorrect|cloud of chances/u);
    expect(responses.map((response) => response.status())).toStrictEqual([404, 404, 404, 404]);

    await apiContext.dispose();
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
