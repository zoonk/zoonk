import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { coursePromptFixture } from "@zoonk/testing/fixtures/course-prompts";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { createAuthenticatedApiContext } from "./helpers/auth";

/**
 * Creates a valid request that will not drive the real generation pipeline.
 * Pending requests enqueue AI/database work in the background, which makes
 * route-contract tests noisy when they only need to prove the API starts a
 * workflow and exposes its status stream. A completed request exercises the
 * same route path while making the workflow finish after its completion event.
 */
async function createCompletedCoursePrompt(title: string) {
  return coursePromptFixture({ canonicalTitle: title, generationStatus: "completed" });
}

test.describe("Course Generation Workflow API", () => {
  let baseURL: string;

  test.beforeAll(async () => {
    baseURL = process.env.E2E_BASE_URL ?? "";

    await getAiOrganization();
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("requires authentication without changing the course prompt", async () => {
    const uniqueId = randomUUID().slice(0, 8);

    const startRequest = await createCompletedCoursePrompt(`E2E Public Course ${uniqueId}`);

    const apiContext = await request.newContext({ baseURL });

    const response = await apiContext.post("/v1/generations", {
      data: { target: { id: startRequest.id, type: "coursePrompt" } },
    });

    expect(response.status()).toBe(401);

    await expect(response.json()).resolves.toMatchObject({
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });

    await expect(
      prisma.coursePrompt.findUniqueOrThrow({ where: { id: startRequest.id } }),
    ).resolves.toMatchObject({ generationRunId: null, generationStatus: "completed" });

    await apiContext.dispose();
  });

  test("rejects language course requests with the same user and target language", async () => {
    const uniqueId = randomUUID().slice(0, 8);

    const startRequest = await coursePromptFixture({
      canonicalTitle: `E2E Same Language Course ${uniqueId}`,
      courseFormat: "language",
      generationStatus: "completed",
      language: "en",
      targetLanguage: "en",
    });

    const { apiContext } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "course-same-language",
    });

    const response = await apiContext.post("/v1/generations", {
      data: { target: { id: startRequest.id, type: "coursePrompt" } },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();

    expect(body.error).toBeDefined();
    expect(body.error.code).toBe("BAD_REQUEST");

    await apiContext.dispose();
  });

  test("returns validation error when coursePromptId is missing", async () => {
    const { apiContext } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "course-validation-missing",
    });

    const response = await apiContext.post("/v1/generations", { data: {} });

    expect(response.status()).toBe(400);

    const body = await response.json();

    expect(body.error).toBeDefined();
    expect(body.error.code).toBe("VALIDATION_ERROR");

    await apiContext.dispose();
  });

  test("returns validation error when coursePromptId is invalid type", async () => {
    const { apiContext } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "course-validation-type",
    });

    const response = await apiContext.post("/v1/generations", {
      data: { target: { id: "invalid", type: "coursePrompt" } },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();

    expect(body.error).toBeDefined();
    expect(body.error.code).toBe("VALIDATION_ERROR");

    await apiContext.dispose();
  });

  test("returns validation error when coursePromptId is invalid number", async () => {
    const { apiContext } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "course-validation-negative",
    });

    const response = await apiContext.post("/v1/generations", {
      data: { target: { id: -1, type: "coursePrompt" } },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();

    expect(body.error).toBeDefined();
    expect(body.error.code).toBe("VALIDATION_ERROR");

    await apiContext.dispose();
  });

  test("starts workflow for valid course prompt", async () => {
    const uniqueId = randomUUID().slice(0, 8);

    const startRequest = await createCompletedCoursePrompt(`E2E Workflow Test ${uniqueId}`);

    const { apiContext } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "course-workflow",
    });

    const response = await apiContext.post("/v1/generations", {
      data: { target: { id: startRequest.id, type: "coursePrompt" } },
    });

    expect(response.status()).toBe(202);

    const body = await response.json();

    expect(body).toStrictEqual({ id: expect.any(String), status: expect.any(String) });

    const generationResponse = await apiContext.get(
      `/v1/generations/${encodeURIComponent(String(body.id))}`,
    );

    expect(generationResponse.status()).toBe(200);

    await expect(generationResponse.json()).resolves.toStrictEqual({
      id: body.id,
      status: expect.any(String),
    });

    await apiContext.dispose();
  });

  test("enrolls the authenticated learner in the generated course", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const organization = await getAiOrganization();

    const course = await courseFixture({
      generationStatus: "completed",
      isPublished: true,
      organizationId: organization.id,
      slug: `e2e-enrolled-course-${uniqueId}`,
      title: `E2E Enrolled Course ${uniqueId}`,
    });

    const coursePrompt = await coursePromptFixture({
      canonicalTitle: course.title,
      courseId: course.id,
      generationStatus: "completed",
    });

    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "course-enrollment",
    });

    const response = await apiContext.post("/v1/generations", {
      data: { target: { id: coursePrompt.id, type: "coursePrompt" } },
    });

    expect(response.status()).toBe(202);

    await expect(async () => {
      const [courseUser, updatedCourse] = await Promise.all([
        prisma.courseUser.findUnique({
          where: { courseUser: { courseId: course.id, userId: user.id } },
        }),
        prisma.course.findUniqueOrThrow({ where: { id: course.id } }),
      ]);

      expect(courseUser).not.toBeNull();
      expect(updatedCourse.userCount).toBe(1);
    }).toPass({ timeout: 10_000 });

    await apiContext.dispose();
  });

  test("returns validation error when the generation ID is empty", async () => {
    const apiContext = await request.newContext({ baseURL });
    const response = await apiContext.get("/v1/generations/%20/events");

    expect(response.status()).toBe(400);

    const body = await response.json();

    expect(body.error).toBeDefined();
    expect(body.error.code).toBe("VALIDATION_ERROR");

    await apiContext.dispose();
  });

  test("returns not found before streaming an unknown generation", async () => {
    const apiContext = await request.newContext({ baseURL });
    const response = await apiContext.get(`/v1/generations/run-${randomUUID()}/events`);

    expect(response.status()).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "NOT_FOUND" } });

    await apiContext.dispose();
  });

  test("returns SSE stream for a created generation", async () => {
    const uniqueId = randomUUID().slice(0, 8);

    const startRequest = await createCompletedCoursePrompt(`E2E Status Test ${uniqueId}`);

    const { apiContext } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "course-status",
    });

    // First create the generation to get its public identifier.
    const triggerResponse = await apiContext.post("/v1/generations", {
      data: { target: { id: startRequest.id, type: "coursePrompt" } },
    });

    const triggerBody = await triggerResponse.json();
    const generationId = triggerBody.id;

    const response = await fetch(
      `${baseURL}/v1/generations/${encodeURIComponent(generationId)}/events`,
      { method: "HEAD" },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/event-stream");

    await apiContext.dispose();
  });
});
