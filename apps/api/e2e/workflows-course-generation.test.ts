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

  test("starts workflow without a session", async () => {
    const uniqueId = randomUUID().slice(0, 8);

    const startRequest = await createCompletedCoursePrompt(`E2E Public Course ${uniqueId}`);

    const apiContext = await request.newContext({ baseURL });

    const response = await apiContext.post("/v1/workflows/course-generation/trigger", {
      data: { coursePromptId: startRequest.id },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();

    expect(body.message).toBe("Workflow started");
    expect(body.runId).toBeDefined();
    expect(typeof body.runId).toBe("string");

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

    const apiContext = await request.newContext({ baseURL });

    const response = await apiContext.post("/v1/workflows/course-generation/trigger", {
      data: { coursePromptId: startRequest.id },
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

    const response = await apiContext.post("/v1/workflows/course-generation/trigger", { data: {} });

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

    const response = await apiContext.post("/v1/workflows/course-generation/trigger", {
      data: { coursePromptId: "invalid" },
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

    const response = await apiContext.post("/v1/workflows/course-generation/trigger", {
      data: { coursePromptId: -1 },
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

    const response = await apiContext.post("/v1/workflows/course-generation/trigger", {
      data: { coursePromptId: startRequest.id },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();

    expect(body.message).toBe("Workflow started");
    expect(body.runId).toBeDefined();
    expect(typeof body.runId).toBe("string");

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

    const response = await apiContext.post("/v1/workflows/course-generation/trigger", {
      data: { coursePromptId: coursePrompt.id },
    });

    expect(response.status()).toBe(200);

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

  test("returns validation error for status endpoint when runId is missing", async () => {
    const apiContext = await request.newContext({ baseURL });
    const response = await apiContext.get("/v1/workflows/course-generation/status");

    expect(response.status()).toBe(400);

    const body = await response.json();

    expect(body.error).toBeDefined();
    expect(body.error.code).toBe("VALIDATION_ERROR");

    await apiContext.dispose();
  });

  test("returns SSE stream for valid runId", async () => {
    const uniqueId = randomUUID().slice(0, 8);

    const startRequest = await createCompletedCoursePrompt(`E2E Status Test ${uniqueId}`);

    const { apiContext } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "course-status",
    });

    // First trigger the workflow to get a runId
    const triggerResponse = await apiContext.post("/v1/workflows/course-generation/trigger", {
      data: { coursePromptId: startRequest.id },
    });

    const triggerBody = await triggerResponse.json();
    const runId = triggerBody.runId;

    const response = await fetch(
      `${baseURL}/v1/workflows/course-generation/status?runId=${runId}`,
      { method: "HEAD" },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/event-stream");

    await apiContext.dispose();
  });
});
