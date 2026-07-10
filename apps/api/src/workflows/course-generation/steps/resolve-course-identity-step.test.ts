import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { resolveCourseIdentity } from "@zoonk/ai/tasks/courses/identity";
import { generateCourseIdentitySearchQueries } from "@zoonk/ai/tasks/courses/identity-search";
import { getCourseSlugForTitle } from "@zoonk/core/courses/slug";
import { prisma } from "@zoonk/db";
import { generatableCoursePromptFixture } from "@zoonk/testing/fixtures/course-prompts";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { normalizeString } from "@zoonk/utils/string";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { assertGeneratableCoursePrompt } from "./get-course-prompt-step";
import { resolveCourseIdentityStep } from "./resolve-course-identity-step";

vi.mock("@zoonk/ai/tasks/courses/identity-search", () => ({
  generateCourseIdentitySearchQueries: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/courses/identity", () => ({ resolveCourseIdentity: vi.fn() }));

const usage = {
  inputTokenDetails: {
    cacheReadTokens: undefined,
    cacheWriteTokens: undefined,
    noCacheTokens: undefined,
  },
  inputTokens: 1,
  outputTokenDetails: { reasoningTokens: undefined, textTokens: undefined },
  outputTokens: 1,
  totalTokens: 2,
};

describe(resolveCourseIdentityStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(generateCourseIdentitySearchQueries).mockResolvedValue({
      data: { queries: [] },
      systemPrompt: "system",
      usage,
      userPrompt: "user",
    });
  });

  it("returns null without calling the classifier when no candidate course exists", async () => {
    const request = await generatableCoursePromptFixture({
      canonicalTitle: `No Candidate ${randomUUID()}`,
    });

    assertGeneratableCoursePrompt(request);

    const result = await resolveCourseIdentityStep(request);

    expect(result).toBeNull();
    expect(resolveCourseIdentity).not.toHaveBeenCalled();
    expect(generateCourseIdentitySearchQueries).toHaveBeenCalledOnce();

    expect(getStreamedEvents()).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "started", step: "generateCourseIdentitySearchQueries" }),
        expect.objectContaining({
          status: "completed",
          step: "generateCourseIdentitySearchQueries",
        }),
        expect.objectContaining({ status: "completed", step: "resolveCourseIdentity" }),
      ]),
    );
  });

  it("returns and stores the existing course when the slug matches", async () => {
    const title = `Existing Course ${randomUUID()}`;
    const slug = getCourseSlugForTitle({ language: "en", title });

    const [course, request] = await Promise.all([
      courseFixture({ organizationId, slug, title }),
      generatableCoursePromptFixture({ canonicalTitle: title, language: "en" }),
    ]);

    assertGeneratableCoursePrompt(request);

    const result = await resolveCourseIdentityStep(request);

    const linkedRequest = await prisma.coursePrompt.findUniqueOrThrow({
      where: { id: request.id },
    });

    expect(result?.id).toBe(course.id);
    expect(linkedRequest.courseId).toBe(course.id);
    expect(resolveCourseIdentity).not.toHaveBeenCalled();
  });

  it("uses AI classification to link semantically equivalent course titles", async () => {
    const [course, request] = await Promise.all([
      courseFixture({
        normalizedTitle: normalizeString("Frontend Development"),
        organizationId,
        slug: `frontend-development-${randomUUID()}`,
        title: "Frontend Development",
      }),
      generatableCoursePromptFixture({ canonicalTitle: "Frontend Engineering", language: "en" }),
    ]);

    assertGeneratableCoursePrompt(request);

    vi.mocked(resolveCourseIdentity).mockResolvedValueOnce({
      data: { courseSlug: course.slug, decision: "useExisting", reason: "same discipline" },
      systemPrompt: "system",
      usage,
      userPrompt: "user",
    });

    vi.mocked(generateCourseIdentitySearchQueries).mockResolvedValueOnce({
      data: { queries: ["frontend development"] },
      systemPrompt: "system",
      usage,
      userPrompt: "user",
    });

    const result = await resolveCourseIdentityStep(request);

    const linkedRequest = await prisma.coursePrompt.findUniqueOrThrow({
      where: { id: request.id },
    });

    expect(result?.id).toBe(course.id);
    expect(linkedRequest.courseId).toBe(course.id);

    expect(resolveCourseIdentity).toHaveBeenCalledWith(
      expect.objectContaining({
        candidates: expect.arrayContaining([
          expect.objectContaining({ slug: course.slug, title: "Frontend Development" }),
        ]),
        proposedCourse: expect.objectContaining({ title: "Frontend Engineering" }),
      }),
    );
  });

  it("leaves the request unlinked when AI says the candidate is different", async () => {
    const [request] = await Promise.all([
      generatableCoursePromptFixture({ canonicalTitle: "Machine Learning", language: "en" }),
      courseFixture({
        normalizedTitle: normalizeString("Deep Learning"),
        organizationId,
        slug: `deep-learning-${randomUUID()}`,
        title: "Deep Learning",
      }),
    ]);

    assertGeneratableCoursePrompt(request);

    vi.mocked(resolveCourseIdentity).mockResolvedValueOnce({
      data: { courseSlug: null, decision: "createNew", reason: "different scope" },
      systemPrompt: "system",
      usage,
      userPrompt: "user",
    });

    vi.mocked(generateCourseIdentitySearchQueries).mockResolvedValueOnce({
      data: { queries: ["deep learning", "machine learning"] },
      systemPrompt: "system",
      usage,
      userPrompt: "user",
    });

    const result = await resolveCourseIdentityStep(request);

    const linkedRequest = await prisma.coursePrompt.findUniqueOrThrow({
      where: { id: request.id },
    });

    expect(result).toBeNull();
    expect(linkedRequest.courseId).toBeNull();
  });

  it("does not split AI search phrases into loose standalone word matches", async () => {
    const [request] = await Promise.all([
      generatableCoursePromptFixture({ canonicalTitle: "Unique Topic", language: "en" }),
      courseFixture({
        normalizedTitle: normalizeString("Science"),
        organizationId,
        slug: `science-${randomUUID()}`,
        title: "Science",
      }),
    ]);

    assertGeneratableCoursePrompt(request);

    vi.mocked(generateCourseIdentitySearchQueries).mockResolvedValueOnce({
      data: { queries: ["data science"] },
      systemPrompt: "system",
      usage,
      userPrompt: "user",
    });

    const result = await resolveCourseIdentityStep(request);

    expect(result).toBeNull();
    expect(resolveCourseIdentity).not.toHaveBeenCalled();
  });

  it("ignores short AI search terms that would create noisy substring matches", async () => {
    const [request] = await Promise.all([
      generatableCoursePromptFixture({ canonicalTitle: "Aprendizado de Máquina", language: "pt" }),
      courseFixture({
        language: "pt",
        normalizedTitle: normalizeString("Inteligência Artificial"),
        organizationId,
        slug: `inteligencia-artificial-${randomUUID()}-pt`,
        title: "Inteligência Artificial",
      }),
    ]);

    assertGeneratableCoursePrompt(request);

    vi.mocked(generateCourseIdentitySearchQueries).mockResolvedValueOnce({
      data: { queries: ["ia"] },
      systemPrompt: "system",
      usage,
      userPrompt: "user",
    });

    const result = await resolveCourseIdentityStep(request);

    expect(result).toBeNull();
    expect(resolveCourseIdentity).not.toHaveBeenCalled();
  });

  it("uses the cached course link before querying AI again", async () => {
    const course = await courseFixture({
      organizationId,
      slug: `cached-course-${randomUUID()}`,
      title: "Cached Course",
    });

    const request = await generatableCoursePromptFixture({
      canonicalTitle: `Cached Request ${randomUUID()}`,
      courseId: course.id,
    });

    assertGeneratableCoursePrompt(request);

    const result = await resolveCourseIdentityStep(request);

    expect(result?.id).toBe(course.id);
    expect(resolveCourseIdentity).not.toHaveBeenCalled();
    expect(generateCourseIdentitySearchQueries).not.toHaveBeenCalled();
  });

  it("ignores a cached and title-matched language course with a different target", async () => {
    const language = `x${randomUUID().slice(0, 8)}`;
    const title = `Cached Language Course ${randomUUID()}`;
    const slug = getCourseSlugForTitle({ language, title });

    const course = await courseFixture({
      format: "language",
      language,
      organizationId,
      slug,
      targetLanguage: "fr",
      title,
    });

    const request = await generatableCoursePromptFixture({
      canonicalTitle: title,
      courseFormat: "language",
      courseId: course.id,
      language,
      targetLanguage: "es",
    });

    assertGeneratableCoursePrompt(request);

    const result = await resolveCourseIdentityStep(request);

    expect(result).toBeNull();
    expect(generateCourseIdentitySearchQueries).not.toHaveBeenCalled();
    expect(resolveCourseIdentity).not.toHaveBeenCalled();
  });

  it("reuses a language course by target when its title does not match", async () => {
    const language = `x${randomUUID().slice(0, 8)}`;

    const course = await courseFixture({
      format: "language",
      language,
      organizationId,
      slug: `spanish-language-${randomUUID()}`,
      targetLanguage: "es",
      title: `Complete Spanish ${randomUUID()}`,
    });

    const request = await generatableCoursePromptFixture({
      canonicalTitle: `Speak Castilian ${randomUUID()}`,
      courseFormat: "language",
      language,
      targetLanguage: "es",
    });

    assertGeneratableCoursePrompt(request);

    const result = await resolveCourseIdentityStep(request);

    const linkedRequest = await prisma.coursePrompt.findUniqueOrThrow({
      where: { id: request.id },
    });

    expect(result?.id).toBe(course.id);
    expect(linkedRequest.courseId).toBe(course.id);
    expect(generateCourseIdentitySearchQueries).not.toHaveBeenCalled();
    expect(resolveCourseIdentity).not.toHaveBeenCalled();
  });

  it("ignores a core course whose target language contradicts its format", async () => {
    const title = `Contradictory Core Course ${randomUUID()}`;
    const slug = getCourseSlugForTitle({ language: "en", title });

    await courseFixture({
      format: "core",
      language: "en",
      organizationId,
      slug,
      targetLanguage: "es",
      title,
    });

    const request = await generatableCoursePromptFixture({
      canonicalTitle: title,
      courseFormat: "core",
      language: "en",
      targetLanguage: null,
    });

    assertGeneratableCoursePrompt(request);

    const result = await resolveCourseIdentityStep(request);

    expect(result).toBeNull();
    expect(generateCourseIdentitySearchQueries).toHaveBeenCalledOnce();
    expect(resolveCourseIdentity).not.toHaveBeenCalled();
  });

  it("uses AI search queries before classifying cross-language title matches", async () => {
    const [course, request] = await Promise.all([
      courseFixture({
        language: "pt",
        normalizedTitle: normalizeString("Machine Learning"),
        organizationId,
        slug: `machine-learning-${randomUUID()}-pt`,
        title: "Machine Learning",
      }),
      generatableCoursePromptFixture({
        canonicalTitle: "Aprendizado de máquina",
        language: "pt",
        prompt: `Aprendizado de máquina ${randomUUID()}`,
      }),
    ]);

    assertGeneratableCoursePrompt(request);

    vi.mocked(generateCourseIdentitySearchQueries).mockResolvedValueOnce({
      data: { queries: ["machine learning"] },
      systemPrompt: "system",
      usage,
      userPrompt: "user",
    });

    vi.mocked(resolveCourseIdentity).mockResolvedValueOnce({
      data: { courseSlug: course.slug, decision: "useExisting", reason: "same subject" },
      systemPrompt: "system",
      usage,
      userPrompt: "user",
    });

    const result = await resolveCourseIdentityStep(request);

    expect(result?.id).toBe(course.id);

    expect(resolveCourseIdentity).toHaveBeenCalledWith(
      expect.objectContaining({
        candidates: expect.arrayContaining([
          expect.objectContaining({ slug: course.slug, title: "Machine Learning" }),
        ]),
      }),
    );
  });
});
