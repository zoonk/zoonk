import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import {
  COURSE_LANGUAGE_MAX_LENGTH,
  COURSE_PROMPT_MAX_LENGTH,
} from "@zoonk/core/courses/prompt-contract";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { coursePromptFixture } from "@zoonk/testing/fixtures/course-prompts";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { normalizeString } from "@zoonk/utils/string";
import { createAuthenticatedApiContext } from "./helpers/auth";

test.describe("Course prompt and generation resources API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("requires authentication before resolving a new course prompt", async () => {
    const prompt = `Anonymous API course prompt ${randomUUID()}`;
    const apiContext = await request.newContext({ baseURL });

    const response = await apiContext.post("/v1/course-prompts", {
      data: { kind: "topic", language: "en", prompt },
    });

    expect(response.status()).toBe(401);

    await expect(response.json()).resolves.toMatchObject({
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });

    await expect(
      prisma.coursePrompt.findUnique({
        where: {
          languageNormalizedPrompt: { language: "en", normalizedPrompt: normalizeString(prompt) },
        },
      }),
    ).resolves.toBeNull();

    await apiContext.dispose();
  });

  test("requires authentication before creating a language course prompt", async () => {
    const language = `en-x-${randomUUID().slice(0, 5)}`;
    const apiContext = await request.newContext({ baseURL });

    const response = await apiContext.post("/v1/course-prompts", {
      data: { kind: "language", language, targetLanguage: "es" },
    });

    expect(response.status()).toBe(401);

    await expect(response.json()).resolves.toMatchObject({
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });

    await expect(
      prisma.coursePrompt.findUnique({
        where: {
          languageNormalizedPrompt: {
            language,
            normalizedPrompt: normalizeString("Learn Spanish"),
          },
        },
      }),
    ).resolves.toBeNull();

    await apiContext.dispose();
  });

  test("creates a language course prompt for an authenticated caller", async () => {
    const language = `en-x-${randomUUID().slice(0, 5)}`;

    const { apiContext } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "language-course-prompt",
    });

    const response = await apiContext.post("/v1/course-prompts", {
      data: { kind: "language", language, targetLanguage: "es" },
    });

    expect(response.status()).toBe(200);

    const responseBody = await response.json();

    const coursePrompt = await prisma.coursePrompt.findUniqueOrThrow({
      where: {
        languageNormalizedPrompt: { language, normalizedPrompt: normalizeString("Learn Spanish") },
      },
    });

    expect(responseBody).toStrictEqual({ coursePromptId: coursePrompt.id, kind: "generation" });

    expect(coursePrompt).toMatchObject({
      courseFormat: "language",
      generationRunId: null,
      generationStatus: "pending",
      targetLanguage: "es",
    });

    await apiContext.dispose();
  });

  test("requires authentication before promoting a cached prompt to generation", async () => {
    const uniqueId = randomUUID();
    const prompt = `Learn focused API design ${uniqueId}`;

    const coursePrompt = await coursePromptFixture({
      canonicalTitle: `Focused API design ${uniqueId}`,
      courseFormat: "coding",
      generationStatus: null,
      language: "en",
      normalizedPrompt: normalizeString(prompt),
      prompt,
    });

    const apiContext = await request.newContext({ baseURL });

    const response = await apiContext.post("/v1/course-prompts", {
      data: { kind: "topic", language: "en", prompt },
    });

    expect(response.status()).toBe(401);

    await expect(response.json()).resolves.toMatchObject({
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });

    await expect(
      prisma.coursePrompt.findUniqueOrThrow({ where: { id: coursePrompt.id } }),
    ).resolves.toMatchObject({ courseFormat: "coding", generationStatus: null });

    await apiContext.dispose();
  });

  test("rejects topic prompts longer than the product limit", async () => {
    const apiContext = await request.newContext({ baseURL });

    const response = await apiContext.post("/v1/course-prompts", {
      data: { kind: "topic", language: "en", prompt: "a".repeat(COURSE_PROMPT_MAX_LENGTH + 1) },
    });

    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "VALIDATION_ERROR" } });

    await apiContext.dispose();
  });

  test("rejects source locales longer than the persisted language limit", async () => {
    const language = "en-Latn-US-u-ca-gregory";
    const apiContext = await request.newContext({ baseURL });

    expect(language.length).toBeGreaterThan(COURSE_LANGUAGE_MAX_LENGTH);

    const response = await apiContext.post("/v1/course-prompts", {
      data: { kind: "language", language, targetLanguage: "mg" },
    });

    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "VALIDATION_ERROR" } });

    await apiContext.dispose();
  });

  test("resolves a language request into an existing course resource", async () => {
    const organization = await getAiOrganization();
    const language = `en-x-${randomUUID().slice(0, 5)}`;

    const course = await courseFixture({
      format: "language",
      generationStatus: "completed",
      isPublished: true,
      language,
      organizationId: organization.id,
      targetLanguage: "mg",
      title: `E2E Malagasy ${randomUUID()}`,
    });

    const apiContext = await request.newContext({ baseURL });

    const response = await apiContext.post("/v1/course-prompts", {
      data: { kind: "language", language, targetLanguage: "mg" },
    });

    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toStrictEqual({ courseId: course.id, kind: "course" });

    await apiContext.dispose();
  });

  test("returns the durable state needed to resume course generation", async () => {
    const generationRunId = `run-${randomUUID()}`;
    const title = `Resume course generation ${randomUUID()}`;

    const coursePrompt = await coursePromptFixture({
      canonicalTitle: title,
      courseFormat: "core",
      generationRunId,
      generationStatus: "running",
    });

    const apiContext = await request.newContext({ baseURL });
    const response = await apiContext.get(`/v1/course-prompts/${coursePrompt.id}`);

    expect(response.status()).toBe(200);

    await expect(response.json()).resolves.toMatchObject({
      completionKind: "introductionLesson",
      courseFormat: "core",
      coursePromptId: coursePrompt.id,
      generationId: generationRunId,
      generationStatus: "running",
      status: "pending",
      title,
    });

    await apiContext.dispose();
  });

  test("returns a structured limit response instead of starting another generation", async () => {
    const now = new Date();

    const periodStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );

    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "course-generation-limit",
    });

    await prisma.generationQuotaCounter.create({
      data: {
        actorKey: `user:${user.id}`,
        count: 5,
        period: "day",
        periodStart,
        resource: "course",
      },
    });

    const coursePrompt = await coursePromptFixture();

    const response = await apiContext.post("/v1/generations", {
      data: { target: { id: coursePrompt.id, type: "coursePrompt" } },
    });

    expect(response.status()).toBe(429);

    await expect(response.json()).resolves.toStrictEqual({
      error: {
        code: "GENERATION_LIMIT_REACHED",
        details: { period: "day", resource: "course", viewer: "authenticated" },
        message: "Generation limit reached",
      },
    });

    const [persistedCounter, persistedPrompt] = await Promise.all([
      prisma.generationQuotaCounter.findUniqueOrThrow({
        where: {
          generationQuotaCounter: {
            actorKey: `user:${user.id}`,
            period: "day",
            periodStart,
            resource: "course",
          },
        },
      }),
      prisma.coursePrompt.findUniqueOrThrow({ where: { id: coursePrompt.id } }),
    ]);

    expect(persistedCounter.count).toBe(5);
    expect(persistedPrompt).toMatchObject({ generationRunId: null, generationStatus: "pending" });

    await apiContext.dispose();
  });

  test("includes the current generation on the chapter resource", async () => {
    const organization = await getAiOrganization();
    const generationRunId = `run-${randomUUID()}`;

    const course = await courseFixture({
      isPublished: true,
      organizationId: organization.id,
      title: `E2E Chapter Generation ${randomUUID()}`,
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      generationRunId,
      generationStatus: "running",
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    const apiContext = await request.newContext({ baseURL });
    const response = await apiContext.get(`/v1/chapters/${chapter.id}`);

    expect(response.status()).toBe(200);

    await expect(response.json()).resolves.toMatchObject({
      generationId: generationRunId,
      generationStatus: "running",
      id: chapter.id,
    });

    await apiContext.dispose();
  });

  test("includes the current generation on the lesson resource", async () => {
    const organization = await getAiOrganization();
    const generationRunId = `run-${randomUUID()}`;

    const course = await courseFixture({
      isPublished: true,
      organizationId: organization.id,
      title: `E2E Lesson Generation ${randomUUID()}`,
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      generationRunId,
      generationStatus: "running",
      isPublished: true,
      kind: "explanation",
      organizationId: organization.id,
    });

    const apiContext = await request.newContext({ baseURL });
    const response = await apiContext.get(`/v1/lessons/${lesson.id}`);

    expect(response.status()).toBe(200);

    await expect(response.json()).resolves.toMatchObject({
      generationId: generationRunId,
      generationStatus: "running",
      id: lesson.id,
    });

    await apiContext.dispose();
  });
});
