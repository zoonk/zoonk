import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { createOrganization, getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { normalizeString } from "@zoonk/utils/string";
import { createAuthenticatedApiContext, createSubscribedApiContext } from "./helpers/auth";

/**
 * Route-contract tests only need a published AI-owned lesson with a specific
 * chapter position. The lesson is already completed so starting the workflow
 * exercises the API gate without making the test depend on real AI generation.
 */
async function createAiLessonForWorkflow({
  aiOrgId,
  chapterPosition,
  lessonPosition = 0,
  uniqueId,
}: {
  aiOrgId: string;
  chapterPosition: number;
  lessonPosition?: number;
  uniqueId: string;
}) {
  const course = await courseFixture({
    isPublished: true,
    organizationId: aiOrgId,
    title: `E2E Lesson Workflow ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: aiOrgId,
    position: chapterPosition,
    title: `E2E Lesson Chapter ${uniqueId}`,
  });

  return lessonFixture({
    chapterId: chapter.id,
    generationStatus: "completed",
    isPublished: true,
    kind: "explanation",
    organizationId: aiOrgId,
    position: lessonPosition,
    title: `E2E Lesson ${uniqueId}`,
  });
}

test.describe("Lesson Generation Workflow API", () => {
  let baseURL: string;
  let aiOrgId: string;

  test.beforeAll(async () => {
    baseURL = process.env.E2E_BASE_URL ?? "";

    const aiOrg = await getAiOrganization();
    aiOrgId = aiOrg.id;
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("allows unauthenticated generation for every first-chapter lesson", async () => {
    const uniqueId = randomUUID().slice(0, 8);

    const lesson = await createAiLessonForWorkflow({
      aiOrgId,
      chapterPosition: 0,
      lessonPosition: 99,
      uniqueId,
    });

    const apiContext = await request.newContext({ baseURL });

    const response = await apiContext.post("/v1/workflows/lesson-generation/trigger", {
      data: { lessonId: lesson.id },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();

    expect(body.message).toBe("Workflow started");
    expect(body.runId).toBeDefined();

    await apiContext.dispose();
  });

  test("returns 402 when unauthenticated generation is outside the first chapter", async () => {
    const uniqueId = randomUUID().slice(0, 8);

    const lesson = await createAiLessonForWorkflow({ aiOrgId, chapterPosition: 1, uniqueId });

    const apiContext = await request.newContext({ baseURL });

    const response = await apiContext.post("/v1/workflows/lesson-generation/trigger", {
      data: { lessonId: lesson.id },
    });

    expect(response.status()).toBe(402);

    const body = await response.json();

    expect(body.error).toBeDefined();
    expect(body.error.code).toBe("PAYMENT_REQUIRED");

    await apiContext.dispose();
  });

  test("returns validation error when lessonId is missing", async () => {
    const { apiContext } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "lesson-validation-missing",
    });

    const response = await apiContext.post("/v1/workflows/lesson-generation/trigger", { data: {} });

    expect(response.status()).toBe(400);

    const body = await response.json();

    expect(body.error).toBeDefined();
    expect(body.error.code).toBe("VALIDATION_ERROR");

    await apiContext.dispose();
  });

  test("returns validation error when lessonId is invalid type", async () => {
    const { apiContext } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "lesson-validation-type",
    });

    const response = await apiContext.post("/v1/workflows/lesson-generation/trigger", {
      data: { lessonId: "invalid" },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();

    expect(body.error).toBeDefined();
    expect(body.error.code).toBe("VALIDATION_ERROR");

    await apiContext.dispose();
  });

  test("returns validation error when lessonId is negative", async () => {
    const { apiContext } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "lesson-validation-negative",
    });

    const response = await apiContext.post("/v1/workflows/lesson-generation/trigger", {
      data: { lessonId: -1 },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();

    expect(body.error).toBeDefined();
    expect(body.error.code).toBe("VALIDATION_ERROR");

    await apiContext.dispose();
  });

  test("returns 402 when user has no active subscription", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const lesson = await createAiLessonForWorkflow({ aiOrgId, chapterPosition: 1, uniqueId });

    const { apiContext } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "lesson-no-subscription",
    });

    const response = await apiContext.post("/v1/workflows/lesson-generation/trigger", {
      data: { lessonId: lesson.id },
    });

    expect(response.status()).toBe(402);

    const body = await response.json();

    expect(body.error).toBeDefined();
    expect(body.error.code).toBe("PAYMENT_REQUIRED");
    expect(body.error.message).toBe("Active subscription required");

    await apiContext.dispose();
  });

  test("allows signed-in first-chapter generation without checking lesson position", async () => {
    const uniqueId = randomUUID().slice(0, 8);

    const lesson = await createAiLessonForWorkflow({
      aiOrgId,
      chapterPosition: 0,
      lessonPosition: 99,
      uniqueId,
    });

    const { apiContext } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "lesson-first-free",
    });

    const response = await apiContext.post("/v1/workflows/lesson-generation/trigger", {
      data: { lessonId: lesson.id },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();

    expect(body.message).toBe("Workflow started");
    expect(body.runId).toBeDefined();
    expect(typeof body.runId).toBe("string");

    await apiContext.dispose();
  });

  test("returns validation error for status endpoint when runId is missing", async () => {
    const { apiContext } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "lesson-non-ai",
    });

    const response = await apiContext.get("/v1/workflows/lesson-generation/status");

    expect(response.status()).toBe(400);

    const body = await response.json();

    expect(body.error).toBeDefined();
    expect(body.error.code).toBe("VALIDATION_ERROR");

    await apiContext.dispose();
  });

  test("returns 404 for lessons outside the AI organization", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const org = await createOrganization();

    const course = await prisma.course.create({
      data: {
        description: "Non-AI course should not allow lesson generation",
        isPublished: true,
        language: "en",
        normalizedTitle: normalizeString(`Non AI Lesson Test ${uniqueId}`),
        organizationId: org.id,
        slug: `non-ai-lesson-test-${uniqueId}`,
        title: `Non AI Lesson Test ${uniqueId}`,
      },
    });

    const chapter = await prisma.chapter.create({
      data: {
        courseId: course.id,
        description: "Non-AI chapter",
        isPublished: true,
        language: "en",
        normalizedTitle: normalizeString("Non AI Chapter"),
        organizationId: org.id,
        position: 0,
        slug: `non-ai-lesson-chapter-${uniqueId}`,
        title: "Non AI Chapter",
      },
    });

    const lesson = await prisma.lesson.create({
      data: {
        chapterId: chapter.id,
        description: "Non-AI lesson",
        isPublished: true,
        kind: "explanation",
        language: "en",
        normalizedTitle: normalizeString("Non AI Lesson"),
        organizationId: org.id,
        position: 0,
        slug: `non-ai-lesson-${uniqueId}`,
        title: "Non AI Lesson",
      },
    });

    const { apiContext } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "lesson-non-ai",
    });

    const response = await apiContext.post("/v1/workflows/lesson-generation/trigger", {
      data: { lessonId: lesson.id },
    });

    expect(response.status()).toBe(404);

    await apiContext.dispose();
  });

  test("starts workflow when practice has an incomplete explanation neighbor", async () => {
    const uniqueId = randomUUID().slice(0, 8);

    const { apiContext } = await createSubscribedApiContext({
      baseURL,
      prefix: "lesson-practice-metadata",
    });

    const course = await prisma.course.create({
      data: {
        description: "Test course for practice generation without explanation dependency",
        isPublished: true,
        language: "en",
        normalizedTitle: normalizeString(`E2E Practice Metadata Test ${uniqueId}`),
        organizationId: aiOrgId,
        slug: `e2e-practice-metadata-${uniqueId}`,
        title: `E2E Practice Metadata Test ${uniqueId}`,
      },
    });

    const chapter = await prisma.chapter.create({
      data: {
        courseId: course.id,
        description: "Test chapter for practice generation without explanation dependency",
        isPublished: true,
        language: "en",
        normalizedTitle: normalizeString("Practice Metadata Chapter"),
        organizationId: aiOrgId,
        position: 0,
        slug: `e2e-practice-metadata-chapter-${uniqueId}`,
        title: "Practice Metadata Chapter",
      },
    });

    const [, practice] = await Promise.all([
      prisma.lesson.create({
        data: {
          chapterId: chapter.id,
          description: "Incomplete explanation neighbor",
          generationStatus: "pending",
          isPublished: true,
          kind: "explanation",
          language: "en",
          normalizedTitle: normalizeString("Practice Metadata Explanation"),
          organizationId: aiOrgId,
          position: 0,
          slug: `e2e-practice-metadata-explanation-${uniqueId}`,
          title: "Practice Metadata Explanation",
        },
      }),
      prisma.lesson.create({
        data: {
          chapterId: chapter.id,
          description: "Practice generated from its own lesson metadata",
          generationStatus: "pending",
          isPublished: true,
          kind: "practice",
          language: "en",
          normalizedTitle: normalizeString("Practice Metadata"),
          organizationId: aiOrgId,
          position: 1,
          slug: `e2e-practice-metadata-lesson-${uniqueId}`,
          title: "Practice Metadata",
        },
      }),
    ]);

    const response = await apiContext.post("/v1/workflows/lesson-generation/trigger", {
      data: { lessonId: practice.id },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();

    expect(body.message).toBe("Workflow started");
    expect(body.runId).toBeDefined();
    expect(typeof body.runId).toBe("string");

    await apiContext.dispose();
  });

  test("returns 404 for translation companion lessons", async () => {
    const uniqueId = randomUUID().slice(0, 8);

    const { apiContext } = await createSubscribedApiContext({
      baseURL,
      prefix: "lesson-translation-companion",
    });

    const course = await prisma.course.create({
      data: {
        description: "Test course for translation companion generation",
        isPublished: true,
        language: "en",
        normalizedTitle: normalizeString(`E2E Translation Companion Test ${uniqueId}`),
        organizationId: aiOrgId,
        slug: `e2e-translation-companion-${uniqueId}`,
        targetLanguage: "de",
        title: `E2E Translation Companion Test ${uniqueId}`,
      },
    });

    const chapter = await prisma.chapter.create({
      data: {
        courseId: course.id,
        description: "Test chapter for translation companion generation",
        isPublished: true,
        language: "en",
        normalizedTitle: normalizeString("Translation Companion Chapter"),
        organizationId: aiOrgId,
        position: 0,
        slug: `e2e-translation-companion-chapter-${uniqueId}`,
        title: "Translation Companion Chapter",
      },
    });

    const [, translation] = await Promise.all([
      prisma.lesson.create({
        data: {
          chapterId: chapter.id,
          description: "Vocabulary source",
          generationStatus: "pending",
          isPublished: true,
          kind: "vocabulary",
          language: "en",
          normalizedTitle: normalizeString("Translation Companion Vocabulary"),
          organizationId: aiOrgId,
          position: 0,
          slug: `e2e-translation-companion-vocabulary-${uniqueId}`,
          title: "Translation Companion Vocabulary",
        },
      }),
      prisma.lesson.create({
        data: {
          chapterId: chapter.id,
          description: "Translation companion",
          generationStatus: "pending",
          isPublished: true,
          kind: "translation",
          language: "en",
          normalizedTitle: normalizeString("Translation Companion"),
          organizationId: aiOrgId,
          position: 1,
          slug: `e2e-translation-companion-${uniqueId}`,
          title: "Translation Companion",
        },
      }),
    ]);

    const response = await apiContext.post("/v1/workflows/lesson-generation/trigger", {
      data: { lessonId: translation.id },
    });

    expect(response.status()).toBe(404);

    const body = await response.json();

    expect(body.error).toBeDefined();
    expect(body.error.code).toBe("NOT_FOUND");

    await apiContext.dispose();
  });

  test("starts workflow successfully with active subscription", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const { apiContext } = await createSubscribedApiContext({ baseURL, prefix: "lesson-success" });

    const course = await prisma.course.create({
      data: {
        description: "Test course for lesson generation with subscription",
        isPublished: true,
        language: "en",
        normalizedTitle: normalizeString(`E2E Lesson Success Test ${uniqueId}`),
        organizationId: aiOrgId,
        slug: `e2e-lesson-success-${uniqueId}`,
        title: `E2E Lesson Success Test ${uniqueId}`,
      },
    });

    const chapter = await prisma.chapter.create({
      data: {
        courseId: course.id,
        description: "Test chapter for workflow success",
        isPublished: true,
        language: "en",
        normalizedTitle: normalizeString("Test Chapter Success"),
        organizationId: aiOrgId,
        position: 0,
        slug: `e2e-chapter-success-${uniqueId}`,
        title: "Test Chapter Success",
      },
    });

    const lesson = await prisma.lesson.create({
      data: {
        chapterId: chapter.id,
        description: "Test lesson for workflow success",
        generationStatus: "completed",
        isPublished: true,
        kind: "explanation",
        language: "en",
        normalizedTitle: normalizeString("Test Lesson Success"),
        organizationId: aiOrgId,
        position: 0,
        slug: `e2e-lesson-success-${uniqueId}`,
        title: "Test Lesson Success",
      },
    });

    const response = await apiContext.post("/v1/workflows/lesson-generation/trigger", {
      data: { lessonId: lesson.id },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();

    expect(body.message).toBe("Workflow started");
    expect(body.runId).toBeDefined();
    expect(typeof body.runId).toBe("string");

    await apiContext.dispose();
  });
});
