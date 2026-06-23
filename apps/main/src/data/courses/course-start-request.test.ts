import { randomUUID } from "node:crypto";
import * as canonicalTitleTask from "@zoonk/ai/tasks/courses/canonical-title";
import * as learnClassificationTask from "@zoonk/ai/tasks/courses/learn-classification";
import * as routingTask from "@zoonk/ai/tasks/courses/request-routing";
import { getCourseSlugForTitle } from "@zoonk/core/courses/slug";
import { prisma } from "@zoonk/db";
import { courseStartRequestFixture } from "@zoonk/testing/fixtures/course-start-requests";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
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

type CourseRedirectStartRequestResolution = Extract<
  CourseStartRequestResolution,
  { kind: "course" }
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
 * Narrows direct-course results so tests can assert the public destination
 * without weakening the resolver union type.
 */
function expectCourseResult(
  result: CourseStartRequestResolution,
): asserts result is CourseRedirectStartRequestResolution {
  expect(result.kind).toBe("course");

  if (result.kind !== "course") {
    throw new Error(`Expected course result, got ${result.kind}`);
  }
}

/**
 * Creates the exact reusable course row the start resolver should find from a
 * canonical title. The slug intentionally mirrors generation so direct reuse
 * and workflow creation stay covered by the same identity rule.
 */
async function createCompletedAiCourse({ language, title }: { language: string; title: string }) {
  const organization = await aiOrganizationFixture();
  const slug = getCourseSlugForTitle({ language, title });

  return courseFixture({
    generationStatus: "completed",
    isPublished: true,
    language,
    normalizedTitle: normalizeString(title),
    organizationId: organization.id,
    slug,
    title,
  });
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

  it("redirects first-time topic prompts to an existing reusable course", async () => {
    const prompt = `existing topic ${randomUUID()}`;
    const title = `Existing Biology ${randomUUID().slice(0, 8)}`;
    const course = await createCompletedAiCourse({ language: "en", title });
    mockStartTasks({ scope: "topic", title });

    const result = await resolveCourseStartRequest({ language: "en", prompt });

    expectCourseResult(result);
    expect(result.href).toBe(`/b/${AI_ORG_SLUG}/c/${course.slug}`);

    const request = await prisma.courseStartRequest.findUnique({
      where: {
        languageNormalizedPrompt: { language: "en", normalizedPrompt: normalizeString(prompt) },
      },
    });

    expect(request).toMatchObject({
      canonicalTitle: title,
      courseId: course.id,
      generationStatus: "completed",
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

  it("redirects cached topic requests to an existing reusable course without model tasks", async () => {
    const prompt = `cached existing topic ${randomUUID()}`;
    const title = `Cached Existing Course ${randomUUID().slice(0, 8)}`;
    const course = await createCompletedAiCourse({ language: "en", title });

    await courseStartRequestFixture({
      canonicalTitle: title,
      normalizedPrompt: normalizeString(prompt),
      prompt,
    });

    const routeSpy = vi.spyOn(routingTask, "routeCourseRequest");
    const classificationSpy = vi.spyOn(learnClassificationTask, "classifyLearnRequest");
    const titleSpy = vi.spyOn(canonicalTitleTask, "generateCanonicalCourseTitle");

    const result = await resolveCourseStartRequest({ language: "en", prompt });

    expectCourseResult(result);
    expect(result.href).toBe(`/b/${AI_ORG_SLUG}/c/${course.slug}`);
    expect(routeSpy).not.toHaveBeenCalled();
    expect(classificationSpy).not.toHaveBeenCalled();
    expect(titleSpy).not.toHaveBeenCalled();
  });

  it("appends the locale when finding existing non-English courses", async () => {
    const prompt = `topico em portugues ${randomUUID()}`;
    const title = `Biologia ${randomUUID().slice(0, 8)}`;
    const course = await createCompletedAiCourse({ language: "pt", title });
    mockStartTasks({ scope: "topic", title });

    const result = await resolveCourseStartRequest({ language: "pt", prompt });

    expect(course.slug).toBe(getCourseSlugForTitle({ language: "pt", title }));
    expect(course.slug.endsWith("-pt")).toBe(true);
    expectCourseResult(result);
    expect(result.href).toBe(`/b/${AI_ORG_SLUG}/c/${course.slug}`);
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
