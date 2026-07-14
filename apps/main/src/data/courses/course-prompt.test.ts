import { randomUUID } from "node:crypto";
import * as canonicalTitleTask from "@zoonk/ai/tasks/courses/canonical-title";
import * as formatTask from "@zoonk/ai/tasks/courses/format";
import * as intentTask from "@zoonk/ai/tasks/courses/intent";
import * as personalizationTask from "@zoonk/ai/tasks/courses/personalization";
import { getCourseSlugForTitle } from "@zoonk/core/courses/slug";
import { prisma } from "@zoonk/db";
import { coursePromptFixture } from "@zoonk/testing/fixtures/course-prompts";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { normalizeString } from "@zoonk/utils/string";
import { describe, expect, it, vi } from "vitest";
import { type CoursePromptResolution, resolveCoursePrompt } from "./course-prompt";

type GenerateCoursePromptResolution = Extract<CoursePromptResolution, { kind: "generate" }>;
type CourseRedirectPromptResolution = Extract<CoursePromptResolution, { kind: "course" }>;

/**
 * Narrows resolver results for TypeScript after Vitest verifies the runtime
 * shape. `expect(result.kind)` is clear to readers but does not narrow unions.
 */
function expectGenerateResult(
  result: CoursePromptResolution,
): asserts result is GenerateCoursePromptResolution {
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
  result: CoursePromptResolution,
): asserts result is CourseRedirectPromptResolution {
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
    format: "core",
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
 * three model tasks run together for first-time prompts, even when the prompt
 * ultimately redirects, waits for a future format, or blocks generation.
 */
function mockPromptTasks({
  courseFormat = "core",
  intent = "learn",
  requiresPersonalization = false,
  title = "Canonical Test Course",
}: {
  courseFormat?: formatTask.CourseFormat;
  intent?: intentTask.CourseIntent;
  requiresPersonalization?: boolean;
  title?: string;
}) {
  const courseFormatSpy = vi.spyOn(formatTask, "classifyCourseFormat");
  const intentSpy = vi.spyOn(intentTask, "classifyCourseIntent");
  const personalizationSpy = vi.spyOn(personalizationTask, "classifyCoursePersonalization");
  const titleSpy = vi.spyOn(canonicalTitleTask, "generateCanonicalCourseTitle");

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- mock return type
  courseFormatSpy.mockResolvedValueOnce({ data: { courseFormat } } as never);
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- mock return type
  intentSpy.mockResolvedValueOnce({ data: { intent } } as never);
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- mock return type
  personalizationSpy.mockResolvedValueOnce({ data: { requiresPersonalization } } as never);
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- mock return type
  titleSpy.mockResolvedValueOnce({ data: { title } } as never);

  return { courseFormatSpy, intentSpy, personalizationSpy, titleSpy };
}

describe("course-prompt", () => {
  it("creates one generatable prompt for reusable core prompts", async () => {
    const prompt = `biology 101 ${randomUUID()}`;
    const title = `Biology ${randomUUID()}`;
    const { courseFormatSpy, intentSpy, personalizationSpy, titleSpy } = mockPromptTasks({ title });

    const result = await resolveCoursePrompt({ language: "en", prompt });

    expectGenerateResult(result);
    expect(result.prompt.canonicalTitle).toBe(title);
    expect(intentSpy).toHaveBeenCalledOnce();
    expect(personalizationSpy).toHaveBeenCalledOnce();
    expect(courseFormatSpy).toHaveBeenCalledOnce();
    expect(titleSpy).toHaveBeenCalledOnce();

    const storedPrompt = await prisma.coursePrompt.findUnique({
      where: {
        languageNormalizedPrompt: { language: "en", normalizedPrompt: normalizeString(prompt) },
      },
    });

    expect(storedPrompt).toMatchObject({
      canonicalTitle: title,
      courseFormat: "core",
      generationStatus: "pending",
      intent: "learn",
    });
  });

  it("redirects first-time reusable core prompts to an existing reusable course", async () => {
    const prompt = `existing topic ${randomUUID()}`;
    const title = `Existing Biology ${randomUUID().slice(0, 8)}`;
    const course = await createCompletedAiCourse({ language: "en", title });
    mockPromptTasks({ title });

    const result = await resolveCoursePrompt({ language: "en", prompt });

    expectCourseResult(result);
    expect(result.href).toBe(`/b/${AI_ORG_SLUG}/c/${course.slug}`);

    const storedPrompt = await prisma.coursePrompt.findUnique({
      where: {
        languageNormalizedPrompt: { language: "en", normalizedPrompt: normalizeString(prompt) },
      },
    });

    expect(storedPrompt).toMatchObject({
      canonicalTitle: title,
      courseId: course.id,
      generationStatus: "completed",
      intent: "learn",
    });
  });

  it("uses a cached reusable prompt without calling model tasks", async () => {
    const prompt = `cached topic ${randomUUID()}`;

    const cached = await coursePromptFixture({
      canonicalTitle: `Cached Course ${randomUUID()}`,
      normalizedPrompt: normalizeString(prompt),
      prompt,
    });

    const intentSpy = vi.spyOn(intentTask, "classifyCourseIntent");
    const personalizationSpy = vi.spyOn(personalizationTask, "classifyCoursePersonalization");
    const courseFormatSpy = vi.spyOn(formatTask, "classifyCourseFormat");
    const titleSpy = vi.spyOn(canonicalTitleTask, "generateCanonicalCourseTitle");

    const result = await resolveCoursePrompt({ language: "en", prompt });

    expectGenerateResult(result);
    expect(result.prompt.id).toBe(cached.id);
    expect(intentSpy).not.toHaveBeenCalled();
    expect(personalizationSpy).not.toHaveBeenCalled();
    expect(courseFormatSpy).not.toHaveBeenCalled();
    expect(titleSpy).not.toHaveBeenCalled();
  });

  it("redirects cached reusable prompts to an existing reusable course without model tasks", async () => {
    const prompt = `cached existing topic ${randomUUID()}`;
    const title = `Cached Existing Course ${randomUUID().slice(0, 8)}`;
    const course = await createCompletedAiCourse({ language: "en", title });

    await coursePromptFixture({
      canonicalTitle: title,
      normalizedPrompt: normalizeString(prompt),
      prompt,
    });

    const intentSpy = vi.spyOn(intentTask, "classifyCourseIntent");
    const personalizationSpy = vi.spyOn(personalizationTask, "classifyCoursePersonalization");
    const courseFormatSpy = vi.spyOn(formatTask, "classifyCourseFormat");
    const titleSpy = vi.spyOn(canonicalTitleTask, "generateCanonicalCourseTitle");

    const result = await resolveCoursePrompt({ language: "en", prompt });

    expectCourseResult(result);
    expect(result.href).toBe(`/b/${AI_ORG_SLUG}/c/${course.slug}`);
    expect(intentSpy).not.toHaveBeenCalled();
    expect(personalizationSpy).not.toHaveBeenCalled();
    expect(courseFormatSpy).not.toHaveBeenCalled();
    expect(titleSpy).not.toHaveBeenCalled();
  });

  it("appends the locale when finding existing non-English courses", async () => {
    const prompt = `topico em portugues ${randomUUID()}`;
    const title = `Biologia ${randomUUID().slice(0, 8)}`;
    const course = await createCompletedAiCourse({ language: "pt", title });
    mockPromptTasks({ title });

    const result = await resolveCoursePrompt({ language: "pt", prompt });

    expect(course.slug).toBe(getCourseSlugForTitle({ language: "pt", title }));
    expect(course.slug.endsWith("-pt")).toBe(true);
    expectCourseResult(result);
    expect(result.href).toBe(`/b/${AI_ORG_SLUG}/c/${course.slug}`);
  });

  it("reuses the winning prompt when the same prompt is resolved concurrently", async () => {
    const prompt = `concurrent topic ${randomUUID()}`;
    const title = `Concurrent Course ${randomUUID()}`;
    const modelTasksStarted: (() => void)[] = [];

    const modelTasksReady = new Promise<void>((resolve) => {
      modelTasksStarted.push(resolve);
    });

    const intentSpy = vi.spyOn(intentTask, "classifyCourseIntent").mockImplementation(async () => {
      await modelTasksReady;
      return { data: { intent: "learn" } } as never;
    });

    vi.spyOn(personalizationTask, "classifyCoursePersonalization").mockImplementation(async () => {
      await modelTasksReady;
      return { data: { requiresPersonalization: false } } as never;
    });

    vi.spyOn(formatTask, "classifyCourseFormat").mockImplementation(async () => {
      await modelTasksReady;
      return { data: { courseFormat: "core" } } as never;
    });

    vi.spyOn(canonicalTitleTask, "generateCanonicalCourseTitle").mockImplementation(async () => {
      await modelTasksReady;
      return { data: { title } } as never;
    });

    const firstResolution = resolveCoursePrompt({ language: "en", prompt });
    const secondResolution = resolveCoursePrompt({ language: "en", prompt });

    await vi.waitFor(() => {
      expect(intentSpy).toHaveBeenCalledTimes(2);
    });

    modelTasksStarted.forEach((startModelTasks) => startModelTasks());

    const results = await Promise.all([firstResolution, secondResolution]);
    const [firstResult, secondResult] = results;

    expectGenerateResult(firstResult);
    expectGenerateResult(secondResult);
    expect(firstResult.prompt.id).toBe(secondResult.prompt.id);

    const promptCount = await prisma.coursePrompt.count({
      where: { language: "en", normalizedPrompt: normalizeString(prompt) },
    });

    expect(promptCount).toBe(1);
  });

  it("persists and redirects reusable language prompts without target language", async () => {
    const prompt = `language prompt ${randomUUID()}`;

    const { courseFormatSpy, intentSpy, personalizationSpy, titleSpy } = mockPromptTasks({
      courseFormat: "language",
    });

    const result = await resolveCoursePrompt({ language: "en", prompt });

    expect(result).toStrictEqual({ href: "/start/speak", kind: "redirect" });
    expect(intentSpy).toHaveBeenCalledOnce();
    expect(personalizationSpy).toHaveBeenCalledOnce();
    expect(courseFormatSpy).toHaveBeenCalledOnce();
    expect(titleSpy).toHaveBeenCalledOnce();

    const storedPrompt = await prisma.coursePrompt.findUnique({
      where: {
        languageNormalizedPrompt: { language: "en", normalizedPrompt: normalizeString(prompt) },
      },
    });

    expect(storedPrompt).toMatchObject({
      courseFormat: "language",
      generationStatus: null,
      intent: "learn",
    });
  });

  it("persists and redirects exam prompts to the exam start path", async () => {
    const prompt = `exam prompt ${randomUUID()}`;
    const title = `Exam Prompt ${randomUUID()}`;

    const { courseFormatSpy, intentSpy, personalizationSpy, titleSpy } = mockPromptTasks({
      intent: "exam",
      title,
    });

    const result = await resolveCoursePrompt({ language: "en", prompt });

    expect(result).toStrictEqual({ href: "/start/exam", kind: "redirect" });
    expect(intentSpy).toHaveBeenCalledOnce();
    expect(personalizationSpy).toHaveBeenCalledOnce();
    expect(courseFormatSpy).toHaveBeenCalledOnce();
    expect(titleSpy).toHaveBeenCalledOnce();

    const storedPrompt = await prisma.coursePrompt.findUnique({
      where: {
        languageNormalizedPrompt: { language: "en", normalizedPrompt: normalizeString(prompt) },
      },
    });

    expect(storedPrompt).toMatchObject({
      canonicalTitle: title,
      courseFormat: "exam",
      generationStatus: null,
      intent: "exam",
    });
  });

  it("redirects cached exam prompts without calling model tasks", async () => {
    const prompt = `cached exam ${randomUUID()}`;

    await coursePromptFixture({
      courseFormat: "exam",
      generationStatus: null,
      intent: "exam",
      normalizedPrompt: normalizeString(prompt),
      prompt,
    });

    const intentSpy = vi.spyOn(intentTask, "classifyCourseIntent");
    const personalizationSpy = vi.spyOn(personalizationTask, "classifyCoursePersonalization");
    const courseFormatSpy = vi.spyOn(formatTask, "classifyCourseFormat");
    const titleSpy = vi.spyOn(canonicalTitleTask, "generateCanonicalCourseTitle");

    const result = await resolveCoursePrompt({ language: "en", prompt });

    expect(result).toStrictEqual({ href: "/start/exam", kind: "redirect" });
    expect(intentSpy).not.toHaveBeenCalled();
    expect(personalizationSpy).not.toHaveBeenCalled();
    expect(courseFormatSpy).not.toHaveBeenCalled();
    expect(titleSpy).not.toHaveBeenCalled();
  });

  it.each([
    { courseFormat: "coding" },
    { courseFormat: "instrument" },
    { courseFormat: "practical" },
  ] as const)(
    "persists waitlist state for learn $courseFormat prompts",
    async ({ courseFormat }) => {
      const prompt = `${courseFormat} prompt ${randomUUID()}`;
      const title = `Unsupported ${courseFormat} ${randomUUID()}`;
      mockPromptTasks({ courseFormat, title });

      const result = await resolveCoursePrompt({ language: "en", prompt });

      expect(result).toStrictEqual({
        kind: "unsupported",
        prompt: { courseFormat, intent: "learn" },
        title,
      });

      const storedPrompt = await prisma.coursePrompt.findUnique({
        where: {
          languageNormalizedPrompt: { language: "en", normalizedPrompt: normalizeString(prompt) },
        },
      });

      expect(storedPrompt).toMatchObject({
        canonicalTitle: title,
        courseFormat,
        generationStatus: null,
        intent: "learn",
      });
    },
  );

  it("persists personalization-required learning prompts as personalized", async () => {
    const prompt = `personalized prompt ${randomUUID()}`;
    const title = `Unsupported personalized ${randomUUID()}`;
    mockPromptTasks({ requiresPersonalization: true, title });

    const result = await resolveCoursePrompt({ language: "en", prompt });

    expect(result).toStrictEqual({
      kind: "unsupported",
      prompt: { courseFormat: "personalized", intent: "learn" },
      title,
    });

    const storedPrompt = await prisma.coursePrompt.findUnique({
      where: {
        languageNormalizedPrompt: { language: "en", normalizedPrompt: normalizeString(prompt) },
      },
    });

    expect(storedPrompt).toMatchObject({
      canonicalTitle: title,
      courseFormat: "personalized",
      generationStatus: null,
      intent: "learn",
    });
  });

  it.each([{ intent: "question" }, { intent: "ambiguous" }] as const)(
    "persists waitlist state for $intent prompts",
    async ({ intent }) => {
      const prompt = `${intent} prompt ${randomUUID()}`;
      const title = `Unsupported ${intent} ${randomUUID()}`;
      mockPromptTasks({ intent, title });

      const courseFormat = intent === "ambiguous" ? "personalized" : intent;
      const result = await resolveCoursePrompt({ language: "en", prompt });

      expect(result).toStrictEqual({
        kind: "unsupported",
        prompt: { courseFormat, intent },
        title,
      });

      const storedPrompt = await prisma.coursePrompt.findUnique({
        where: {
          languageNormalizedPrompt: { language: "en", normalizedPrompt: normalizeString(prompt) },
        },
      });

      expect(storedPrompt).toMatchObject({
        canonicalTitle: title,
        courseFormat,
        generationStatus: null,
        intent,
      });
    },
  );

  it("persists unsafe prompts without generation fields", async () => {
    const prompt = `unsafe prompt ${randomUUID()}`;

    const { courseFormatSpy, intentSpy, personalizationSpy, titleSpy } = mockPromptTasks({
      intent: "unsafe",
    });

    const result = await resolveCoursePrompt({ language: "en", prompt });

    expect(result).toStrictEqual({ kind: "unsafe" });
    expect(intentSpy).toHaveBeenCalledOnce();
    expect(personalizationSpy).toHaveBeenCalledOnce();
    expect(courseFormatSpy).toHaveBeenCalledOnce();
    expect(titleSpy).toHaveBeenCalledOnce();

    const storedPrompt = await prisma.coursePrompt.findUnique({
      where: {
        languageNormalizedPrompt: { language: "en", normalizedPrompt: normalizeString(prompt) },
      },
    });

    expect(storedPrompt).toMatchObject({
      canonicalTitle: null,
      courseFormat: null,
      generationStatus: null,
      intent: "unsafe",
    });
  });
});
