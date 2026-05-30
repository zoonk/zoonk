import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { createOrganization, getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { createAuthenticatedApiContext } from "./helpers/auth";

/**
 * Preload trigger tests should prove the subscription gate, not the lesson
 * generation workflow internals. Completed lesson rows make the triggered
 * workflow finish as a no-op after the route has accepted the request.
 */
async function createAiLessonForPreload({
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
    title: `E2E Preload Workflow ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: aiOrgId,
    position: chapterPosition,
    title: `E2E Preload Chapter ${uniqueId}`,
  });

  return lessonFixture({
    chapterId: chapter.id,
    generationStatus: "completed",
    isPublished: true,
    kind: "explanation",
    organizationId: aiOrgId,
    position: lessonPosition,
    title: `E2E Preload Lesson ${uniqueId}`,
  });
}

test.describe("Lesson Preload Workflow API", () => {
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

  test("allows unauthenticated preload through the first five first-chapter lessons", async () => {
    const uniqueId = randomUUID().slice(0, 8);

    const lesson = await createAiLessonForPreload({
      aiOrgId,
      chapterPosition: 0,
      lessonPosition: 4,
      uniqueId,
    });

    const apiContext = await request.newContext({ baseURL });

    const response = await apiContext.post("/v1/workflows/lesson-preload/trigger", {
      data: { lessonId: lesson.id },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();

    expect(body.message).toBe("Workflow started");
    expect(body.runId).toBeDefined();

    await apiContext.dispose();
  });

  test("returns 401 when unauthenticated preload needs the login-expanded preview", async () => {
    const uniqueId = randomUUID().slice(0, 8);

    const lesson = await createAiLessonForPreload({
      aiOrgId,
      chapterPosition: 0,
      lessonPosition: 5,
      uniqueId,
    });

    const apiContext = await request.newContext({ baseURL });

    const response = await apiContext.post("/v1/workflows/lesson-preload/trigger", {
      data: { lessonId: lesson.id },
    });

    expect(response.status()).toBe(401);

    const body = await response.json();

    expect(body.error).toBeDefined();
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(body.error.message).toBe("Authentication required");

    await apiContext.dispose();
  });

  test("returns 402 when unauthenticated preload is outside the free preview", async () => {
    const uniqueId = randomUUID().slice(0, 8);

    const lesson = await createAiLessonForPreload({
      aiOrgId,
      chapterPosition: 0,
      lessonPosition: 10,
      uniqueId,
    });

    const apiContext = await request.newContext({ baseURL });

    const response = await apiContext.post("/v1/workflows/lesson-preload/trigger", {
      data: { lessonId: lesson.id },
    });

    expect(response.status()).toBe(402);

    const body = await response.json();

    expect(body.error).toBeDefined();
    expect(body.error.code).toBe("PAYMENT_REQUIRED");

    await apiContext.dispose();
  });

  test("returns 402 when a later chapter lesson has no active subscription", async () => {
    const uniqueId = randomUUID().slice(0, 8);

    const lesson = await createAiLessonForPreload({ aiOrgId, chapterPosition: 1, uniqueId });

    const { apiContext } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "preload-no-subscription",
    });

    const response = await apiContext.post("/v1/workflows/lesson-preload/trigger", {
      data: { lessonId: lesson.id },
    });

    expect(response.status()).toBe(402);

    const body = await response.json();

    expect(body.error).toBeDefined();
    expect(body.error.code).toBe("PAYMENT_REQUIRED");
    expect(body.error.message).toBe("Active subscription required");

    await apiContext.dispose();
  });

  test("allows signed-in first-chapter preload through lesson ten without subscription", async () => {
    const uniqueId = randomUUID().slice(0, 8);

    const lesson = await createAiLessonForPreload({
      aiOrgId,
      chapterPosition: 0,
      lessonPosition: 9,
      uniqueId,
    });

    const { apiContext } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "preload-first-free",
    });

    const response = await apiContext.post("/v1/workflows/lesson-preload/trigger", {
      data: { lessonId: lesson.id },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();

    expect(body.message).toBe("Workflow started");
    expect(body.runId).toBeDefined();
    expect(typeof body.runId).toBe("string");

    await apiContext.dispose();
  });

  test("returns 402 for signed-in first-chapter lesson eleven without subscription", async () => {
    const uniqueId = randomUUID().slice(0, 8);

    const lesson = await createAiLessonForPreload({
      aiOrgId,
      chapterPosition: 0,
      lessonPosition: 10,
      uniqueId,
    });

    const { apiContext } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "preload-eleven-no-subscription",
    });

    const response = await apiContext.post("/v1/workflows/lesson-preload/trigger", {
      data: { lessonId: lesson.id },
    });

    expect(response.status()).toBe(402);

    const body = await response.json();

    expect(body.error).toBeDefined();
    expect(body.error.code).toBe("PAYMENT_REQUIRED");

    await apiContext.dispose();
  });

  test("returns 404 for signed-in requests to non-AI first chapter lessons", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const org = await createOrganization();

    const course = await courseFixture({
      isPublished: true,
      organizationId: org.id,
      title: `E2E Non-AI Preload ${uniqueId}`,
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: org.id,
      position: 0,
      title: `E2E Non-AI Preload Chapter ${uniqueId}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "completed",
      isPublished: true,
      organizationId: org.id,
      title: `E2E Non-AI Preload Lesson ${uniqueId}`,
    });

    const { apiContext } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "preload-non-ai",
    });

    const response = await apiContext.post("/v1/workflows/lesson-preload/trigger", {
      data: { lessonId: lesson.id },
    });

    expect(response.status()).toBe(404);

    await apiContext.dispose();
  });
});
