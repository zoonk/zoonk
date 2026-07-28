import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { coursePromptFixture } from "@zoonk/testing/fixtures/course-prompts";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture, organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { normalizeString } from "@zoonk/utils/string";
import { describe, expect, it } from "vitest";
import { listCompletedLanguageCourses, resolveLanguageCourse } from "./language-course";
import { resolveCoursePrompt } from "./resolve-course-prompt";

/**
 * Creates a source-language value that no seeded course should use, so each
 * test can assert the full returned href map without depending on cleanup.
 */
function getUniqueSourceLanguage() {
  return `q${randomUUID().slice(0, 8)}`;
}

/**
 * Creates a unique valid BCP 47 locale for code paths that localize language
 * names through Intl while still isolating their persisted prompt cache keys.
 */
function getUniqueSourceLocale() {
  return `en-x-${randomUUID().slice(0, 5)}`;
}

/**
 * Builds stable test slugs with a readable prefix so failed assertions make it
 * clear which fixture was supposed to be returned.
 */
function getCourseSlug(label: string) {
  return `language-href-${label}-${randomUUID().slice(0, 8)}`;
}

/**
 * Gives each prompt-order test a valid unique locale while keeping the target
 * language realistic. The locale isolates persisted prompt keys without
 * bypassing the public resolver's language-name localization.
 */
function getLanguageCoursePromptInput() {
  return { language: getUniqueSourceLocale(), targetLanguage: "es" };
}

/**
 * Narrows a public language-course outcome for tests that exercise generation
 * persistence after confirming no completed course exists for their unique
 * source locale.
 */
function getGenerationPrompt(resolution: Awaited<ReturnType<typeof resolveLanguageCourse>>) {
  if (resolution.kind !== "generation") {
    throw new Error("Expected a language-course generation request");
  }

  return resolution.coursePrompt;
}

describe(listCompletedLanguageCourses, () => {
  it("returns completed published AI language courses in the source language", async () => {
    const organization = await aiOrganizationFixture();
    const language = getUniqueSourceLanguage();
    const icelandicSlug = getCourseSlug("icelandic");
    const javaneseSlug = getCourseSlug("javanese");

    await Promise.all([
      courseFixture({
        format: "language",
        generationStatus: "completed",
        isPublished: true,
        language,
        organizationId: organization.id,
        slug: icelandicSlug,
        targetLanguage: "is",
      }),
      courseFixture({
        format: "language",
        generationStatus: "completed",
        isPublished: true,
        language,
        organizationId: organization.id,
        slug: javaneseSlug,
        targetLanguage: "jv",
      }),
    ]);

    const courses = await listCompletedLanguageCourses({ language });

    expect(courses).toHaveLength(2);

    expect(
      courses.map(({ course, targetLanguage }) => ({ slug: course.slug, targetLanguage })),
    ).toStrictEqual(
      expect.arrayContaining([
        { slug: icelandicSlug, targetLanguage: "is" },
        { slug: javaneseSlug, targetLanguage: "jv" },
      ]),
    );
  });

  it("ignores courses that are not eligible completed language courses", async () => {
    const [aiOrganization, otherOrganization] = await Promise.all([
      aiOrganizationFixture(),
      organizationFixture(),
    ]);

    const language = getUniqueSourceLanguage();
    const eligibleSlug = getCourseSlug("eligible");

    await Promise.all([
      courseFixture({
        format: "language",
        generationStatus: "completed",
        isPublished: true,
        language,
        organizationId: aiOrganization.id,
        slug: eligibleSlug,
        targetLanguage: "is",
      }),
      courseFixture({
        format: "language",
        generationStatus: "completed",
        isPublished: true,
        language: getUniqueSourceLanguage(),
        organizationId: aiOrganization.id,
        targetLanguage: "jv",
      }),
      courseFixture({
        format: "language",
        generationStatus: "completed",
        isPublished: false,
        language,
        organizationId: aiOrganization.id,
        targetLanguage: "jv",
      }),
      courseFixture({
        format: "language",
        generationStatus: "pending",
        isPublished: true,
        language,
        organizationId: aiOrganization.id,
        targetLanguage: "jv",
      }),
      courseFixture({
        format: "language",
        generationStatus: "completed",
        isPublished: true,
        language,
        organizationId: otherOrganization.id,
        targetLanguage: "jv",
      }),
      courseFixture({
        format: "language",
        generationStatus: "completed",
        isPublished: true,
        language,
        organizationId: aiOrganization.id,
        targetLanguage: "xx",
      }),
      courseFixture({
        format: "language",
        generationStatus: "completed",
        isPublished: true,
        language,
        organizationId: aiOrganization.id,
        targetLanguage: null,
      }),
    ]);

    const courses = await listCompletedLanguageCourses({ language });

    expect(
      courses.map(({ course, targetLanguage }) => ({ slug: course.slug, targetLanguage })),
    ).toStrictEqual([{ slug: eligibleSlug, targetLanguage: "is" }]);
  });

  it("uses the newest completed course when a target language has duplicates", async () => {
    const organization = await aiOrganizationFixture();
    const language = getUniqueSourceLanguage();
    const newerSlug = getCourseSlug("newer");

    await Promise.all([
      courseFixture({
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        format: "language",
        generationStatus: "completed",
        isPublished: true,
        language,
        organizationId: organization.id,
        slug: getCourseSlug("older"),
        targetLanguage: "is",
      }),
      courseFixture({
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
        format: "language",
        generationStatus: "completed",
        isPublished: true,
        language,
        organizationId: organization.id,
        slug: newerSlug,
        targetLanguage: "is",
      }),
    ]);

    const courses = await listCompletedLanguageCourses({ language });

    expect(
      courses.map(({ course, targetLanguage }) => ({ slug: course.slug, targetLanguage })),
    ).toStrictEqual([{ slug: newerSlug, targetLanguage: "is" }]);
  });
});

describe(resolveLanguageCourse, () => {
  it("returns the newest completed course without creating a generation prompt", async () => {
    const organization = await aiOrganizationFixture();
    const language = getUniqueSourceLanguage();
    const newerSlug = getCourseSlug("resolution-newer");

    await Promise.all([
      courseFixture({
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        format: "language",
        generationStatus: "completed",
        isPublished: true,
        language,
        organizationId: organization.id,
        slug: getCourseSlug("resolution-older"),
        targetLanguage: "es",
      }),
      courseFixture({
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
        format: "language",
        generationStatus: "completed",
        isPublished: true,
        language,
        organizationId: organization.id,
        slug: newerSlug,
        targetLanguage: "es",
      }),
    ]);

    const resolution = await resolveLanguageCourse({ language, targetLanguage: "es" });

    const generationPrompt = await prisma.coursePrompt.findUnique({
      where: {
        languageNormalizedPrompt: { language, normalizedPrompt: normalizeString("Learn Spanish") },
      },
    });

    expect(resolution).toMatchObject({ course: { slug: newerSlug }, kind: "course" });
    expect(generationPrompt).toBeNull();
  });

  it("creates the controlled generation request when no completed course exists", async () => {
    const language = getUniqueSourceLocale();

    const resolution = await resolveLanguageCourse({ language, targetLanguage: "es" });

    expect(resolution).toMatchObject({
      coursePrompt: {
        canonicalTitle: "Spanish",
        courseFormat: "language",
        generationStatus: "pending",
        intent: "learn",
        language,
        prompt: "Learn Spanish",
        targetLanguage: "es",
      },
      kind: "generation",
    });
  });

  it("creates one controlled prompt when the first requests arrive concurrently", async () => {
    const input = getLanguageCoursePromptInput();
    const prompt = "Learn Spanish";

    const resolutions = await Promise.all(
      Array.from({ length: 10 }, () => resolveLanguageCourse(input)),
    );

    const requests = resolutions.map((resolution) => getGenerationPrompt(resolution));

    expect(new Set(requests.map((request) => request.id)).size).toBe(1);

    const promptCount = await prisma.coursePrompt.count({
      where: { language: input.language, normalizedPrompt: normalizeString(prompt) },
    });

    expect(promptCount).toBe(1);
  });

  it("promotes one unstarted public prompt when controlled requests arrive concurrently", async () => {
    const input = getLanguageCoursePromptInput();
    const prompt = "Learn Spanish";

    const publicPrompt = await coursePromptFixture({
      canonicalTitle: "Spanish",
      courseFormat: "language",
      generationStatus: null,
      language: input.language,
      normalizedPrompt: normalizeString(prompt),
      prompt,
      targetLanguage: null,
    });

    const [firstResolution, secondResolution] = await Promise.all([
      resolveLanguageCourse(input),
      resolveLanguageCourse(input),
    ]);

    const firstPrompt = getGenerationPrompt(firstResolution);
    const secondPrompt = getGenerationPrompt(secondResolution);

    expect(firstPrompt).toMatchObject({
      canonicalTitle: "Spanish",
      courseFormat: "language",
      generationStatus: "pending",
      id: publicPrompt.id,
      intent: "learn",
      targetLanguage: input.targetLanguage,
    });

    expect(secondPrompt.id).toBe(firstPrompt.id);

    const promptCount = await prisma.coursePrompt.count({
      where: { language: input.language, normalizedPrompt: normalizeString(prompt) },
    });

    expect(promptCount).toBe(1);
  });

  it("keeps a controlled language prompt when the public resolver sees it later", async () => {
    const input = getLanguageCoursePromptInput();
    const controlledPrompt = getGenerationPrompt(await resolveLanguageCourse(input));

    const resolution = await resolveCoursePrompt({
      language: input.language,
      prompt: "Learn Spanish",
    });

    expect(resolution).toStrictEqual({
      kind: "generate",
      prompt: {
        canonicalTitle: "Spanish",
        courseFormat: "language",
        id: controlledPrompt.id,
        intent: "learn",
      },
    });
  });

  it("does not replace an incompatible prompt that is ready to generate", async () => {
    const input = getLanguageCoursePromptInput();
    const prompt = "Learn Spanish";

    const pendingPrompt = await coursePromptFixture({
      canonicalTitle: "Spanish",
      courseFormat: "core",
      generationStatus: "pending",
      language: input.language,
      normalizedPrompt: normalizeString(prompt),
      prompt,
      targetLanguage: null,
    });

    await expect(resolveLanguageCourse(input)).rejects.toThrow();

    const persistedPrompt = await prisma.coursePrompt.findUniqueOrThrow({
      where: { id: pendingPrompt.id },
    });

    expect(persistedPrompt).toMatchObject({
      courseFormat: "core",
      generationStatus: "pending",
      targetLanguage: null,
    });
  });

  it("does not replace an incompatible prompt after generation has started", async () => {
    const input = getLanguageCoursePromptInput();
    const prompt = "Learn Spanish";
    const generationRunId = `run-${randomUUID()}`;
    const course = await courseFixture({ generationRunId, generationStatus: "running" });

    const startedPrompt = await coursePromptFixture({
      canonicalTitle: "Spanish",
      courseFormat: "core",
      courseId: course.id,
      generationRunId,
      generationStatus: "running",
      language: input.language,
      normalizedPrompt: normalizeString(prompt),
      prompt,
      targetLanguage: null,
    });

    await expect(resolveLanguageCourse(input)).rejects.toThrow();

    const persistedPrompt = await prisma.coursePrompt.findUniqueOrThrow({
      where: { id: startedPrompt.id },
    });

    expect(persistedPrompt).toMatchObject({
      courseFormat: "core",
      courseId: course.id,
      generationRunId,
      generationStatus: "running",
      targetLanguage: null,
    });
  });
});
