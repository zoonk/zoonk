import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { courseSuggestionFixture } from "@zoonk/testing/fixtures/courses";
import { expect, test } from "../fixtures";

const TEST_COURSE_TITLE = "E2E Test Course";

async function createTestSuggestion() {
  return courseSuggestionFixture({
    locale: "en",
    prompt: `e2e-test-${randomUUID()}`,
    suggestions: [
      { description: "Test description", title: TEST_COURSE_TITLE },
    ],
  });
}

async function cleanupGeneratedCourse(title: string) {
  await prisma.course.deleteMany({
    where: { title },
  });
}

async function cleanupGenerationRun(suggestionId: number) {
  await prisma.courseGenerationRun.deleteMany({
    where: { courseSuggestionId: suggestionId },
  });
}

type StreamEvent = {
  data?: Record<string, unknown>;
  status: string;
  step: string;
  timestamp: number;
};

type StreamHeadersSuccess = {
  cacheControl: string | null;
  contentType: string | null;
  runId: string | null;
  status: number;
};

type StreamEventsSuccess = {
  events: StreamEvent[];
};

type ResumeSuccess = {
  cacheControl: string | null;
  contentType: string | null;
  status: number;
};

type AbortedResult = { aborted: true };
type ErrorResult = { error: string; status?: number };

test.describe("POST /api/workflows/course-generation", () => {
  test("returns 400 when courseSuggestionId is missing", async ({
    authenticatedPage,
    baseURL,
  }) => {
    const response = await authenticatedPage.request.post(
      `${baseURL}/api/workflows/course-generation`,
      {
        data: { courseTitle: "Test Course" },
      },
    );

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("courseSuggestionId");
  });

  test("returns 400 when courseSuggestionId is not a number", async ({
    authenticatedPage,
    baseURL,
  }) => {
    const response = await authenticatedPage.request.post(
      `${baseURL}/api/workflows/course-generation`,
      {
        data: {
          courseSuggestionId: "not-a-number",
          courseTitle: "Test Course",
        },
      },
    );

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("courseSuggestionId");
  });

  test("returns 400 when courseTitle is missing", async ({
    authenticatedPage,
    baseURL,
  }) => {
    const response = await authenticatedPage.request.post(
      `${baseURL}/api/workflows/course-generation`,
      {
        data: { courseSuggestionId: 1 },
      },
    );

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("courseTitle");
  });

  test("returns 400 when courseTitle is not a string", async ({
    authenticatedPage,
    baseURL,
  }) => {
    const response = await authenticatedPage.request.post(
      `${baseURL}/api/workflows/course-generation`,
      {
        data: { courseSuggestionId: 1, courseTitle: 123 },
      },
    );

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("courseTitle");
  });

  test("returns event stream with correct headers and X-Workflow-Run-Id", async ({
    authenticatedPage,
    baseURL,
  }) => {
    const suggestion = await createTestSuggestion();

    try {
      await authenticatedPage.goto("/");

      const result: StreamHeadersSuccess | AbortedResult =
        await authenticatedPage.evaluate(
          async ({ url, suggestionId, title }) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);

            try {
              const response = await fetch(url, {
                body: JSON.stringify({
                  courseSuggestionId: suggestionId,
                  courseTitle: title,
                }),
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                method: "POST",
                signal: controller.signal,
              });

              clearTimeout(timeoutId);

              return {
                cacheControl: response.headers.get("cache-control"),
                contentType: response.headers.get("content-type"),
                runId: response.headers.get("x-workflow-run-id"),
                status: response.status,
              };
            } catch (error) {
              clearTimeout(timeoutId);
              if ((error as Error).name === "AbortError") {
                return { aborted: true as const };
              }
              throw error;
            }
          },
          {
            suggestionId: suggestion.id,
            title: TEST_COURSE_TITLE,
            url: `${baseURL}/api/workflows/course-generation`,
          },
        );

      expect("aborted" in result).toBe(false);

      if ("aborted" in result) {
        throw new Error("Request was aborted before headers were received");
      }

      expect(result.status).toBe(200);
      expect(result.contentType).toBe("text/event-stream");
      expect(result.cacheControl).toBe("no-cache");
      expect(result.runId).toBeDefined();
      expect(typeof result.runId).toBe("string");
      expect(result.runId?.length).toBeGreaterThan(0);
    } finally {
      await cleanupGenerationRun(suggestion.id);
      await cleanupGeneratedCourse(TEST_COURSE_TITLE);
      await prisma.courseSuggestion.delete({ where: { id: suggestion.id } });
    }
  });

  test("stream emits valid JSON line events", async ({
    authenticatedPage,
    baseURL,
  }) => {
    const suggestion = await createTestSuggestion();

    try {
      await authenticatedPage.goto("/");

      const result: StreamEventsSuccess | AbortedResult | ErrorResult =
        await authenticatedPage.evaluate(
          // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: page.evaluate requires inline function with error handling
          async ({ url, suggestionId, title }) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);

            const response = await fetch(url, {
              body: JSON.stringify({
                courseSuggestionId: suggestionId,
                courseTitle: title,
              }),
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              method: "POST",
              signal: controller.signal,
            }).catch((error: Error) => {
              clearTimeout(timeoutId);
              if (error.name === "AbortError") {
                return null;
              }
              throw error;
            });

            if (!response) {
              return { aborted: true as const };
            }
            if (!(response.ok && response.body)) {
              clearTimeout(timeoutId);
              return { error: "Bad response", status: response.status };
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            const events: StreamEvent[] = [];

            while (events.length < 3) {
              // biome-ignore lint/performance/noAwaitInLoops: streaming requires sequential reads
              const { done, value } = await reader.read();
              if (done) {
                break;
              }

              const text = decoder.decode(value, { stream: true });
              for (const line of text.split("\n").filter((l) => l.trim())) {
                try {
                  const event = JSON.parse(line);
                  if (event.step && event.status && event.timestamp) {
                    events.push(event);
                  }
                } catch {
                  // Skip invalid JSON
                }
              }
            }

            clearTimeout(timeoutId);
            reader.cancel();
            return { events };
          },
          {
            suggestionId: suggestion.id,
            title: TEST_COURSE_TITLE,
            url: `${baseURL}/api/workflows/course-generation`,
          },
        );

      expect("aborted" in result).toBe(false);
      expect("error" in result).toBe(false);

      if ("aborted" in result) {
        throw new Error("Request was aborted before events were received");
      }

      if ("error" in result) {
        throw new Error(`Request failed: ${result.error}`);
      }

      expect(result.events.length).toBeGreaterThan(0);

      for (const event of result.events) {
        expect(event).toHaveProperty("step");
        expect(event).toHaveProperty("status");
        expect(event).toHaveProperty("timestamp");
        expect(typeof event.step).toBe("string");
        expect(["started", "completed", "failed"]).toContain(event.status);
        expect(typeof event.timestamp).toBe("number");
      }
    } finally {
      await cleanupGenerationRun(suggestion.id);
      await cleanupGeneratedCourse(TEST_COURSE_TITLE);
      await prisma.courseSuggestion.delete({ where: { id: suggestion.id } });
    }
  });
});

test.describe("GET /api/workflows/course-generation/[runId]", () => {
  test("returns 404 for non-existent run", async ({
    authenticatedPage,
    baseURL,
  }) => {
    const fakeRunId = `non-existent-${randomUUID()}`;

    const response = await authenticatedPage.request.get(
      `${baseURL}/api/workflows/course-generation/${fakeRunId}`,
    );

    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("Run not found");
  });

  test("returns event stream for existing run", async ({
    authenticatedPage,
    baseURL,
  }) => {
    const suggestion = await createTestSuggestion();

    try {
      await authenticatedPage.goto("/");

      const result: ResumeSuccess | AbortedResult | ErrorResult =
        await authenticatedPage.evaluate(
          async ({ url, suggestionId, title }) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const startResponse = await fetch(url, {
              body: JSON.stringify({
                courseSuggestionId: suggestionId,
                courseTitle: title,
              }),
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              method: "POST",
              signal: controller.signal,
            }).catch((error: Error) => {
              clearTimeout(timeoutId);
              if (error.name === "AbortError") {
                return null;
              }
              throw error;
            });

            if (!startResponse) {
              return { aborted: true as const };
            }

            const runId = startResponse.headers.get("x-workflow-run-id");

            if (!runId) {
              clearTimeout(timeoutId);
              return { error: "No runId in response" };
            }

            const resumeResponse = await fetch(`${url}/${runId}`, {
              credentials: "include",
              method: "GET",
              signal: controller.signal,
            }).catch((error: Error) => {
              clearTimeout(timeoutId);
              if (error.name === "AbortError") {
                return null;
              }
              throw error;
            });

            clearTimeout(timeoutId);

            if (!resumeResponse) {
              return { aborted: true as const };
            }

            return {
              cacheControl: resumeResponse.headers.get("cache-control"),
              contentType: resumeResponse.headers.get("content-type"),
              status: resumeResponse.status,
            };
          },
          {
            suggestionId: suggestion.id,
            title: TEST_COURSE_TITLE,
            url: `${baseURL}/api/workflows/course-generation`,
          },
        );

      expect("aborted" in result).toBe(false);
      expect("error" in result).toBe(false);

      if ("aborted" in result) {
        throw new Error("Request was aborted before response was received");
      }

      if ("error" in result) {
        throw new Error(`Request failed: ${result.error}`);
      }

      expect(result.status).toBe(200);
      expect(result.contentType).toBe("text/event-stream");
      expect(result.cacheControl).toBe("no-cache");
    } finally {
      await cleanupGenerationRun(suggestion.id);
      await cleanupGeneratedCourse(TEST_COURSE_TITLE);
      await prisma.courseSuggestion.delete({ where: { id: suggestion.id } });
    }
  });

  test("resume with startIndex returns stream from specified point", async ({
    authenticatedPage,
    baseURL,
  }) => {
    const suggestion = await createTestSuggestion();

    try {
      await authenticatedPage.goto("/");

      const result: ResumeSuccess | AbortedResult | ErrorResult =
        await authenticatedPage.evaluate(
          async ({ url, suggestionId, title }) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const startResponse = await fetch(url, {
              body: JSON.stringify({
                courseSuggestionId: suggestionId,
                courseTitle: title,
              }),
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              method: "POST",
              signal: controller.signal,
            }).catch((error: Error) => {
              clearTimeout(timeoutId);
              if (error.name === "AbortError") {
                return null;
              }
              throw error;
            });

            if (!startResponse) {
              return { aborted: true as const };
            }

            const runId = startResponse.headers.get("x-workflow-run-id");

            if (!runId) {
              clearTimeout(timeoutId);
              return { error: "No runId in response" };
            }

            const resumeResponse = await fetch(`${url}/${runId}?startIndex=0`, {
              credentials: "include",
              method: "GET",
              signal: controller.signal,
            }).catch((error: Error) => {
              clearTimeout(timeoutId);
              if (error.name === "AbortError") {
                return null;
              }
              throw error;
            });

            clearTimeout(timeoutId);

            if (!resumeResponse) {
              return { aborted: true as const };
            }

            return {
              cacheControl: resumeResponse.headers.get("cache-control"),
              contentType: resumeResponse.headers.get("content-type"),
              status: resumeResponse.status,
            };
          },
          {
            suggestionId: suggestion.id,
            title: TEST_COURSE_TITLE,
            url: `${baseURL}/api/workflows/course-generation`,
          },
        );

      expect("aborted" in result).toBe(false);
      expect("error" in result).toBe(false);

      if ("aborted" in result) {
        throw new Error("Request was aborted before response was received");
      }

      if ("error" in result) {
        throw new Error(`Request failed: ${result.error}`);
      }

      expect(result.status).toBe(200);
      expect(result.contentType).toBe("text/event-stream");
    } finally {
      await cleanupGenerationRun(suggestion.id);
      await cleanupGeneratedCourse(TEST_COURSE_TITLE);
      await prisma.courseSuggestion.delete({ where: { id: suggestion.id } });
    }
  });
});
