import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { getAiOrganization } from "@zoonk/e2e/helpers";
import { expect, test } from "./fixtures";

test.describe("Course Generation Workflow API", () => {
  let baseURL: string;

  test.beforeAll(async () => {
    baseURL = process.env.E2E_BASE_URL ?? "";

    await getAiOrganization();
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("returns validation error when courseSuggestionId is missing", async () => {
    const apiContext = await request.newContext({ baseURL });
    const response = await apiContext.post("/v1/workflows/course-generation/trigger", {
      data: {},
    });

    expect(response.status()).toBe(400);

    const body = await response.json();

    expect(body.error).toBeDefined();
    expect(body.error.code).toBe("VALIDATION_ERROR");

    await apiContext.dispose();
  });

  test("returns validation error when courseSuggestionId is invalid type", async () => {
    const apiContext = await request.newContext({ baseURL });
    const response = await apiContext.post("/v1/workflows/course-generation/trigger", {
      data: { courseSuggestionId: "invalid" },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();

    expect(body.error).toBeDefined();
    expect(body.error.code).toBe("VALIDATION_ERROR");

    await apiContext.dispose();
  });

  test("returns validation error when courseSuggestionId is negative", async () => {
    const apiContext = await request.newContext({ baseURL });
    const response = await apiContext.post("/v1/workflows/course-generation/trigger", {
      data: { courseSuggestionId: -1 },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();

    expect(body.error).toBeDefined();
    expect(body.error.code).toBe("VALIDATION_ERROR");

    await apiContext.dispose();
  });

  test("starts workflow for valid course suggestion", async () => {
    const uniqueId = randomUUID().slice(0, 8);

    // Create a course suggestion
    const suggestion = await prisma.courseSuggestion.create({
      data: {
        description: `E2E test course description ${uniqueId}`,
        language: "en",
        slug: `e2e-workflow-test-${uniqueId}`,
        title: `E2E Workflow Test ${uniqueId}`,
      },
    });

    const apiContext = await request.newContext({ baseURL });
    const response = await apiContext.post("/v1/workflows/course-generation/trigger", {
      data: { courseSuggestionId: suggestion.id },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();

    expect(body.message).toBe("Workflow started");
    expect(body.runId).toBeDefined();
    expect(typeof body.runId).toBe("string");

    // Cleanup
    await prisma.courseSuggestion.delete({ where: { id: suggestion.id } });
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

    // Create a course suggestion
    const suggestion = await prisma.courseSuggestion.create({
      data: {
        description: `E2E test course description ${uniqueId}`,
        language: "en",
        slug: `e2e-status-test-${uniqueId}`,
        title: `E2E Status Test ${uniqueId}`,
      },
    });

    const apiContext = await request.newContext({ baseURL });

    // First trigger the workflow to get a runId
    const triggerResponse = await apiContext.post("/v1/workflows/course-generation/trigger", {
      data: { courseSuggestionId: suggestion.id },
    });

    const triggerBody = await triggerResponse.json();
    const runId = triggerBody.runId;

    // Use fetch with AbortController to test SSE headers without waiting for stream completion
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(
        `${baseURL}/v1/workflows/course-generation/status?runId=${runId}`,
        {
          signal: controller.signal,
        },
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("text/event-stream");
    } catch (error) {
      // AbortError is expected when we abort the stream early
      if (error instanceof Error && error.name !== "AbortError") {
        throw error;
      }
    } finally {
      clearTimeout(timeoutId);
      controller.abort();
    }

    // Cleanup - delete suggestion (workflow will fail but that's okay for this test)
    await prisma.courseSuggestion.delete({ where: { id: suggestion.id } });
    await apiContext.dispose();
  });
});
