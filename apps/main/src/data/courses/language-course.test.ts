import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { coursePromptFixture } from "@zoonk/testing/fixtures/course-prompts";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture, organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { normalizeString } from "@zoonk/utils/string";
import { describe, expect, it } from "vitest";
import { resolveCoursePrompt } from "./course-prompt";
import {
  getCompletedLanguageCourseHrefs,
  getOrCreateLanguageCoursePromptRequest,
} from "./language-course";

/**
 * Creates a source-language value that no seeded course should use, so each
 * test can assert the full returned href map without depending on cleanup.
 */
function getUniqueSourceLanguage() {
  return `q${randomUUID().slice(0, 8)}`;
}

/**
 * Builds stable test slugs with a readable prefix so failed assertions make it
 * clear which fixture was supposed to be returned.
 */
function getCourseSlug(label: string) {
  return `language-href-${label}-${randomUUID().slice(0, 8)}`;
}

/**
 * Gives each prompt-order test its own cache key while keeping the controlled
 * target language realistic. The source locale is intentionally synthetic so
 * tests can run concurrently without cleaning shared prompt rows.
 */
function getLanguageCoursePromptInput() {
  return {
    language: getUniqueSourceLanguage(),
    targetLanguage: "es",
    title: `Spanish ${randomUUID().slice(0, 8)}`,
  };
}

describe(getCompletedLanguageCourseHrefs, () => {
  it("returns hrefs for completed published AI language courses in the source language", async () => {
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

    const hrefs = await getCompletedLanguageCourseHrefs({ language });

    expect(hrefs).toStrictEqual({
      is: `/b/${AI_ORG_SLUG}/c/${icelandicSlug}`,
      jv: `/b/${AI_ORG_SLUG}/c/${javaneseSlug}`,
    });
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

    const hrefs = await getCompletedLanguageCourseHrefs({ language });

    expect(hrefs).toStrictEqual({ is: `/b/${AI_ORG_SLUG}/c/${eligibleSlug}` });
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

    const hrefs = await getCompletedLanguageCourseHrefs({ language });

    expect(hrefs).toStrictEqual({ is: `/b/${AI_ORG_SLUG}/c/${newerSlug}` });
  });
});

describe(getOrCreateLanguageCoursePromptRequest, () => {
  it("creates one controlled prompt when the first requests arrive concurrently", async () => {
    const input = getLanguageCoursePromptInput();
    const prompt = `Learn ${input.title}`;

    const requests = await Promise.all(
      Array.from({ length: 10 }, () => getOrCreateLanguageCoursePromptRequest(input)),
    );

    expect(new Set(requests.map((request) => request.id)).size).toBe(1);

    const promptCount = await prisma.coursePrompt.count({
      where: { language: input.language, normalizedPrompt: normalizeString(prompt) },
    });

    expect(promptCount).toBe(1);
  });

  it("promotes one unstarted public prompt when controlled requests arrive concurrently", async () => {
    const input = getLanguageCoursePromptInput();
    const prompt = `Learn ${input.title}`;

    const publicPrompt = await coursePromptFixture({
      canonicalTitle: input.title,
      courseFormat: "language",
      generationStatus: null,
      language: input.language,
      normalizedPrompt: normalizeString(prompt),
      prompt,
      targetLanguage: null,
    });

    const [firstPrompt, secondPrompt] = await Promise.all([
      getOrCreateLanguageCoursePromptRequest(input),
      getOrCreateLanguageCoursePromptRequest(input),
    ]);

    expect(firstPrompt).toMatchObject({
      canonicalTitle: input.title,
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
    const controlledPrompt = await getOrCreateLanguageCoursePromptRequest(input);

    const resolution = await resolveCoursePrompt({
      language: input.language,
      prompt: `Learn ${input.title}`,
    });

    expect(resolution).toStrictEqual({
      kind: "generate",
      prompt: {
        canonicalTitle: input.title,
        courseFormat: "language",
        id: controlledPrompt.id,
        intent: "learn",
      },
    });
  });

  it("does not replace an incompatible prompt that is ready to generate", async () => {
    const input = getLanguageCoursePromptInput();
    const prompt = `Learn ${input.title}`;

    const pendingPrompt = await coursePromptFixture({
      canonicalTitle: input.title,
      courseFormat: "core",
      generationStatus: "pending",
      language: input.language,
      normalizedPrompt: normalizeString(prompt),
      prompt,
      targetLanguage: null,
    });

    await expect(getOrCreateLanguageCoursePromptRequest(input)).rejects.toThrow();

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
    const prompt = `Learn ${input.title}`;
    const generationRunId = `run-${randomUUID()}`;
    const course = await courseFixture({ generationRunId, generationStatus: "running" });

    const startedPrompt = await coursePromptFixture({
      canonicalTitle: input.title,
      courseFormat: "core",
      courseId: course.id,
      generationRunId,
      generationStatus: "running",
      language: input.language,
      normalizedPrompt: normalizeString(prompt),
      prompt,
      targetLanguage: null,
    });

    await expect(getOrCreateLanguageCoursePromptRequest(input)).rejects.toThrow();

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
