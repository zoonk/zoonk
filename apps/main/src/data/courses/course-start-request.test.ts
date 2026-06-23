import { randomUUID } from "node:crypto";
import * as canonicalTitleTask from "@zoonk/ai/tasks/courses/canonical-title";
import * as learnClassificationTask from "@zoonk/ai/tasks/courses/learn-classification";
import * as routingTask from "@zoonk/ai/tasks/courses/request-routing";
import { prisma } from "@zoonk/db";
import { courseStartRequestFixture } from "@zoonk/testing/fixtures/course-start-requests";
import { normalizeString } from "@zoonk/utils/string";
import { describe, expect, it, vi } from "vitest";
import {
  type CourseStartRequestResolution,
  resolveCourseStartRequest,
} from "./course-start-request";

type GenerateCourseStartRequestResolution = Extract<
  CourseStartRequestResolution,
  { kind: "generate" }
>;

/**
 * Narrows resolver results for TypeScript after Vitest verifies the runtime
 * shape. `expect(result.kind)` is clear to readers but does not narrow unions.
 */
function expectGenerateResult(
  result: CourseStartRequestResolution,
): asserts result is GenerateCourseStartRequestResolution {
  expect(result.kind).toBe("generate");

  if (result.kind !== "generate") {
    throw new Error(`Expected generate result, got ${result.kind}`);
  }
}

/**
 * Mocks the model tasks with production-shaped return values so resolver tests
 * can prove the orchestration boundaries without making network calls. All
 * three model tasks run together for first-time prompts, even when the route
 * ultimately redirects or blocks generation.
 */
function mockStartTasks({
  classification = "course",
  scope,
  title = "Canonical Test Course",
}: {
  classification?: learnClassificationTask.LearnRequestClassification;
  scope: routingTask.CourseRequestScope;
  title?: string;
}) {
  const classificationSpy = vi.spyOn(learnClassificationTask, "classifyLearnRequest");
  const routeSpy = vi.spyOn(routingTask, "routeCourseRequest");
  const titleSpy = vi.spyOn(canonicalTitleTask, "generateCanonicalCourseTitle");

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- mock return type
  routeSpy.mockResolvedValueOnce({ data: { scope } } as never);
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- mock return type
  classificationSpy.mockResolvedValueOnce({ data: { classification } } as never);
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- mock return type
  titleSpy.mockResolvedValueOnce({ data: { title } } as never);

  return { classificationSpy, routeSpy, titleSpy };
}

describe("course-start-request", () => {
  it("creates one generatable request for topic prompts", async () => {
    const prompt = `biology 101 ${randomUUID()}`;
    const title = `Biology ${randomUUID()}`;
    const { classificationSpy, routeSpy, titleSpy } = mockStartTasks({ scope: "topic", title });

    const result = await resolveCourseStartRequest({ language: "en", prompt });

    expectGenerateResult(result);
    expect(result.request.canonicalTitle).toBe(title);
    expect(routeSpy).toHaveBeenCalledOnce();
    expect(classificationSpy).toHaveBeenCalledOnce();
    expect(titleSpy).toHaveBeenCalledOnce();

    const request = await prisma.courseStartRequest.findUnique({
      where: {
        languageNormalizedPrompt: { language: "en", normalizedPrompt: normalizeString(prompt) },
      },
    });

    expect(request).toMatchObject({
      canonicalTitle: title,
      courseMode: "full",
      generationStatus: "pending",
      scope: "topic",
    });
  });

  it("uses a cached topic request without calling model tasks", async () => {
    const prompt = `cached topic ${randomUUID()}`;

    const cached = await courseStartRequestFixture({
      canonicalTitle: `Cached Course ${randomUUID()}`,
      normalizedPrompt: normalizeString(prompt),
      prompt,
    });

    const routeSpy = vi.spyOn(routingTask, "routeCourseRequest");
    const classificationSpy = vi.spyOn(learnClassificationTask, "classifyLearnRequest");
    const titleSpy = vi.spyOn(canonicalTitleTask, "generateCanonicalCourseTitle");

    const result = await resolveCourseStartRequest({ language: "en", prompt });

    expectGenerateResult(result);
    expect(result.request.id).toBe(cached.id);
    expect(routeSpy).not.toHaveBeenCalled();
    expect(classificationSpy).not.toHaveBeenCalled();
    expect(titleSpy).not.toHaveBeenCalled();
  });

  it("reuses the winning request when the same prompt is resolved concurrently", async () => {
    const prompt = `concurrent topic ${randomUUID()}`;
    const title = `Concurrent Course ${randomUUID()}`;
    const modelTasksStarted: (() => void)[] = [];

    const modelTasksReady = new Promise<void>((resolve) => {
      modelTasksStarted.push(resolve);
    });

    const routeSpy = vi.spyOn(routingTask, "routeCourseRequest").mockImplementation(async () => {
      await modelTasksReady;
      return { data: { scope: "topic" } } as never;
    });

    vi.spyOn(learnClassificationTask, "classifyLearnRequest").mockImplementation(async () => {
      await modelTasksReady;
      return { data: { classification: "course" } } as never;
    });

    vi.spyOn(canonicalTitleTask, "generateCanonicalCourseTitle").mockImplementation(async () => {
      await modelTasksReady;
      return { data: { title } } as never;
    });

    const firstResolution = resolveCourseStartRequest({ language: "en", prompt });
    const secondResolution = resolveCourseStartRequest({ language: "en", prompt });

    await vi.waitFor(() => {
      expect(routeSpy).toHaveBeenCalledTimes(2);
    });

    modelTasksStarted.forEach((startModelTasks) => startModelTasks());

    const results = await Promise.all([firstResolution, secondResolution]);
    const [firstResult, secondResult] = results;

    expectGenerateResult(firstResult);
    expectGenerateResult(secondResult);
    expect(firstResult.request.id).toBe(secondResult.request.id);

    const requestCount = await prisma.courseStartRequest.count({
      where: { language: "en", normalizedPrompt: normalizeString(prompt) },
    });

    expect(requestCount).toBe(1);
  });

  it.each([
    { href: "/start/exam", scope: "exam" },
    { href: "/start/speak", scope: "language" },
  ] as const)("persists and redirects $scope prompts", async ({ href, scope }) => {
    const prompt = `${scope} prompt ${randomUUID()}`;
    const { classificationSpy, routeSpy, titleSpy } = mockStartTasks({ scope });

    const result = await resolveCourseStartRequest({ language: "en", prompt });

    expect(result).toStrictEqual({ href, kind: "redirect" });
    expect(routeSpy).toHaveBeenCalledOnce();
    expect(classificationSpy).toHaveBeenCalledOnce();
    expect(titleSpy).toHaveBeenCalledOnce();

    const request = await prisma.courseStartRequest.findUnique({
      where: {
        languageNormalizedPrompt: { language: "en", normalizedPrompt: normalizeString(prompt) },
      },
    });

    expect(request).toMatchObject({ generationStatus: null, scope });
  });

  it.each([
    { classification: "question", courseMode: "quick", scope: "question" },
    { classification: "personalized", courseMode: "personalized", scope: "personalized" },
  ] as const)(
    "persists waitlist mode for $classification prompts",
    async ({ classification, courseMode, scope }) => {
      const prompt = `${scope} prompt ${randomUUID()}`;
      const title = `Unsupported ${scope} ${randomUUID()}`;
      mockStartTasks({ classification, scope: "topic", title });

      const result = await resolveCourseStartRequest({ language: "en", prompt });

      expect(result).toStrictEqual({ kind: "unsupported", scope, title });

      const request = await prisma.courseStartRequest.findUnique({
        where: {
          languageNormalizedPrompt: { language: "en", normalizedPrompt: normalizeString(prompt) },
        },
      });

      expect(request).toMatchObject({
        canonicalTitle: title,
        courseMode,
        generationStatus: null,
        scope,
      });
    },
  );

  it("persists unsafe prompts without generation fields", async () => {
    const prompt = `unsafe prompt ${randomUUID()}`;
    const { classificationSpy, routeSpy, titleSpy } = mockStartTasks({ scope: "unsafe" });

    const result = await resolveCourseStartRequest({ language: "en", prompt });

    expect(result).toStrictEqual({ kind: "unsafe" });
    expect(routeSpy).toHaveBeenCalledOnce();
    expect(classificationSpy).toHaveBeenCalledOnce();
    expect(titleSpy).toHaveBeenCalledOnce();

    const request = await prisma.courseStartRequest.findUnique({
      where: {
        languageNormalizedPrompt: { language: "en", normalizedPrompt: normalizeString(prompt) },
      },
    });

    expect(request).toMatchObject({
      canonicalTitle: null,
      courseMode: null,
      generationStatus: null,
      scope: "unsafe",
    });
  });
});
