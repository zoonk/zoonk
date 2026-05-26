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
  uniqueId,
}: {
  aiOrgId: string;
  chapterPosition: number;
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

  test("returns 401 when triggering lesson generation without a session", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const lesson = await createAiLessonForWorkflow({ aiOrgId, chapterPosition: 0, uniqueId });
    const apiContext = await request.newContext({ baseURL });

    const response = await apiContext.post("/v1/workflows/lesson-generation/trigger", {
      data: { lessonId: lesson.id },
    });

    expect(response.status()).toBe(401);

    const body = await response.json();

    expect(body.error).toBeDefined();
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(body.error.message).toBe("Authentication required");

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

  test("allows signed-in first chapter lesson generation without subscription", async () => {
    const uniqueId = randomUUID().slice(0, 8);

    const lesson = await createAiLessonForWorkflow({ aiOrgId, chapterPosition: 0, uniqueId });

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

  test("returns 409 when practice has an incomplete explanation prerequisite", async () => {
    const uniqueId = randomUUID().slice(0, 8);

    const { apiContext } = await createSubscribedApiContext({
      baseURL,
      prefix: "lesson-blocked-practice",
    });

    const course = await prisma.course.create({
      data: {
        description: "Test course for blocked practice generation",
        isPublished: true,
        language: "en",
        normalizedTitle: normalizeString(`E2E Blocked Practice Test ${uniqueId}`),
        organizationId: aiOrgId,
        slug: `e2e-blocked-practice-${uniqueId}`,
        title: `E2E Blocked Practice Test ${uniqueId}`,
      },
    });

    const chapter = await prisma.chapter.create({
      data: {
        courseId: course.id,
        description: "Test chapter for blocked practice generation",
        isPublished: true,
        language: "en",
        normalizedTitle: normalizeString("Blocked Practice Chapter"),
        organizationId: aiOrgId,
        position: 0,
        slug: `e2e-blocked-practice-chapter-${uniqueId}`,
        title: "Blocked Practice Chapter",
      },
    });

    const [, practice] = await Promise.all([
      prisma.lesson.create({
        data: {
          chapterId: chapter.id,
          description: "Incomplete explanation prerequisite",
          generationStatus: "pending",
          isPublished: true,
          kind: "explanation",
          language: "en",
          normalizedTitle: normalizeString("Blocked Practice Explanation"),
          organizationId: aiOrgId,
          position: 0,
          slug: `e2e-blocked-practice-explanation-${uniqueId}`,
          title: "Blocked Practice Explanation",
        },
      }),
      prisma.lesson.create({
        data: {
          chapterId: chapter.id,
          description: "Practice blocked by incomplete explanation",
          generationStatus: "pending",
          isPublished: true,
          kind: "practice",
          language: "en",
          normalizedTitle: normalizeString("Blocked Practice"),
          organizationId: aiOrgId,
          position: 1,
          slug: `e2e-blocked-practice-${uniqueId}`,
          title: "Blocked Practice",
        },
      }),
    ]);

    const response = await apiContext.post("/v1/workflows/lesson-generation/trigger", {
      data: { lessonId: practice.id },
    });

    expect(response.status()).toBe(409);

    const body = await response.json();

    expect(body.error).toBeDefined();
    expect(body.error.code).toBe("CONFLICT");
    expect(body.error.message).toBe("Create the required lesson first");

    await apiContext.dispose();
  });

  test("returns 409 when translation has an incomplete vocabulary prerequisite", async () => {
    const uniqueId = randomUUID().slice(0, 8);

    const { apiContext } = await createSubscribedApiContext({
      baseURL,
      prefix: "lesson-blocked-translation",
    });

    const course = await prisma.course.create({
      data: {
        description: "Test course for blocked translation generation",
        isPublished: true,
        language: "en",
        normalizedTitle: normalizeString(`E2E Blocked Translation Test ${uniqueId}`),
        organizationId: aiOrgId,
        slug: `e2e-blocked-translation-${uniqueId}`,
        targetLanguage: "de",
        title: `E2E Blocked Translation Test ${uniqueId}`,
      },
    });

    const chapter = await prisma.chapter.create({
      data: {
        courseId: course.id,
        description: "Test chapter for blocked translation generation",
        isPublished: true,
        language: "en",
        normalizedTitle: normalizeString("Blocked Translation Chapter"),
        organizationId: aiOrgId,
        position: 0,
        slug: `e2e-blocked-translation-chapter-${uniqueId}`,
        title: "Blocked Translation Chapter",
      },
    });

    const [, translation] = await Promise.all([
      prisma.lesson.create({
        data: {
          chapterId: chapter.id,
          description: "Incomplete vocabulary prerequisite",
          generationStatus: "pending",
          isPublished: true,
          kind: "vocabulary",
          language: "en",
          normalizedTitle: normalizeString("Blocked Translation Vocabulary"),
          organizationId: aiOrgId,
          position: 0,
          slug: `e2e-blocked-translation-vocabulary-${uniqueId}`,
          title: "Blocked Translation Vocabulary",
        },
      }),
      prisma.lesson.create({
        data: {
          chapterId: chapter.id,
          description: "Translation blocked by incomplete vocabulary",
          generationStatus: "pending",
          isPublished: true,
          kind: "translation",
          language: "en",
          normalizedTitle: normalizeString("Blocked Translation"),
          organizationId: aiOrgId,
          position: 1,
          slug: `e2e-blocked-translation-${uniqueId}`,
          title: "Blocked Translation",
        },
      }),
    ]);

    const response = await apiContext.post("/v1/workflows/lesson-generation/trigger", {
      data: { lessonId: translation.id },
    });

    expect(response.status()).toBe(409);

    const body = await response.json();

    expect(body.error).toBeDefined();
    expect(body.error.code).toBe("CONFLICT");
    expect(body.error.message).toBe("Create the required lesson first");

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
