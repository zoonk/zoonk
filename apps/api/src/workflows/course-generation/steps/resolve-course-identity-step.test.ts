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
    vi.mocked(generateCourseIdentitySearchQueries).mockReset();
    vi.mocked(resolveCourseIdentity).mockReset();

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
      courseFixture({ isPublished: true, organizationId, slug, title }),
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

  it("skips a hidden cached slug match and uses the published course with the same title", async () => {
    const title = `Published Identity ${randomUUID()}`;

    const [hidden, published] = await Promise.all([
      courseFixture({
        isPublished: false,
        language: "pt",
        organizationId,
        slug: getCourseSlugForTitle({ language: "pt", title }),
        title,
      }),
      courseFixture({
        isPublished: true,
        language: "pt",
        normalizedTitle: normalizeString(title),
        organizationId,
        title,
      }),
    ]);

    const request = await generatableCoursePromptFixture({
      canonicalTitle: title,
      courseId: hidden.id,
      language: "pt",
    });

    assertGeneratableCoursePrompt(request);

    const result = await resolveCourseIdentityStep(request);
    const persisted = await prisma.coursePrompt.findUniqueOrThrow({ where: { id: request.id } });

    expect(result?.id).toBe(published.id);
    expect(persisted.courseId).toBe(published.id);
    expect(resolveCourseIdentity).not.toHaveBeenCalled();
    expect(generateCourseIdentitySearchQueries).not.toHaveBeenCalled();
  });

  it.each(["pt", "pt-BR"])(
    "uses a stored %s family edition before searching aliases",
    async (language) => {
      const family = await prisma.courseFamily.create({ data: {} });

      const [source, edition, request] = await Promise.all([
        courseFixture({
          familyId: family.id,
          isPublished: true,
          language: "en",
          organizationId,
          title: `Computer Science ${randomUUID()}`,
        }),
        courseFixture({
          familyId: family.id,
          isPublished: true,
          language,
          organizationId,
          slug: `ciencia-da-computacao-${randomUUID()}-pt`,
          title: "Ciência da Computação",
        }),
        generatableCoursePromptFixture({
          canonicalTitle: `Computação ${randomUUID()}`,
          language: "pt",
        }),
      ]);

      assertGeneratableCoursePrompt(request);

      await prisma.courseEditionRequest.create({
        data: { coursePromptId: request.id, language: "pt", sourceCourseId: source.id },
      });

      const result = await resolveCourseIdentityStep(request);

      const persistedPrompt = await prisma.coursePrompt.findUniqueOrThrow({
        where: { id: request.id },
      });

      expect(result?.id).toBe(edition.id);
      expect(result?.slug).toBe(edition.slug);
      expect(persistedPrompt.courseId).toBe(edition.id);
      expect(generateCourseIdentitySearchQueries).not.toHaveBeenCalled();
      expect(resolveCourseIdentity).not.toHaveBeenCalled();
    },
  );

  it("returns and stores an exact-slug course with a different regular format", async () => {
    const title = `Existing Cross Format Course ${randomUUID()}`;
    const slug = getCourseSlugForTitle({ language: "en", title });

    const [course, request] = await Promise.all([
      courseFixture({ format: "core", isPublished: true, organizationId, slug, title }),
      generatableCoursePromptFixture({
        canonicalTitle: title,
        courseFormat: "coding",
        language: "en",
      }),
    ]);

    assertGeneratableCoursePrompt(request);

    const result = await resolveCourseIdentityStep(request);

    const linkedRequest = await prisma.coursePrompt.findUniqueOrThrow({
      where: { id: request.id },
    });

    expect(result?.id).toBe(course.id);
    expect(result?.format).toBe("core");
    expect(linkedRequest).toMatchObject({ courseFormat: "coding", courseId: course.id });
    expect(generateCourseIdentitySearchQueries).not.toHaveBeenCalled();
    expect(resolveCourseIdentity).not.toHaveBeenCalled();
  });

  it("uses AI classification to link semantically equivalent course titles", async () => {
    const [course, request] = await Promise.all([
      courseFixture({
        isPublished: true,
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

  it("preserves published source context when an older edition source was unpublished", async () => {
    const title = `Bread Making ${randomUUID()}`;

    const [source, course, request] = await Promise.all([
      courseFixture({
        description: "Préparer des pains avec de la farine, de l’eau et de la levure.",
        isPublished: true,
        language: "fr",
        organizationId,
        title: "Pain",
      }),
      courseFixture({
        isPublished: true,
        normalizedTitle: normalizeString(title),
        organizationId,
        title,
      }),
      generatableCoursePromptFixture({
        canonicalTitle: `Bread Baking ${randomUUID()}`,
        language: "en",
      }),
    ]);

    assertGeneratableCoursePrompt(request);

    const removedSource = await courseFixture({
      description: "Physical discomfort and its treatment.",
      isPublished: false,
      language: "en",
      organizationId,
      title: "Pain",
    });

    await prisma.courseEditionRequest.create({
      data: {
        coursePromptId: request.id,
        createdAt: new Date(0),
        language: "en",
        sourceCourseId: removedSource.id,
      },
    });

    await prisma.courseEditionRequest.create({
      data: { coursePromptId: request.id, language: "en", sourceCourseId: source.id },
    });

    vi.mocked(generateCourseIdentitySearchQueries).mockResolvedValueOnce({
      data: { queries: [title] },
      systemPrompt: "system",
      usage,
      userPrompt: "user",
    });

    vi.mocked(resolveCourseIdentity).mockResolvedValueOnce({
      data: { courseSlug: course.slug, decision: "useExisting", reason: "same bread making topic" },
      systemPrompt: "system",
      usage,
      userPrompt: "user",
    });

    const result = await resolveCourseIdentityStep(request);

    const proposedCourse = {
      description: JSON.stringify({
        description: source.description,
        instructionalLanguage: source.language,
        title: source.title,
      }),
      language: "en",
      targetLanguage: null,
      title: request.canonicalTitle,
    };

    expect(result?.id).toBe(course.id);
    expect(generateCourseIdentitySearchQueries).toHaveBeenCalledWith({ proposedCourse });
    expect(resolveCourseIdentity).toHaveBeenCalledWith(expect.objectContaining({ proposedCourse }));
  });

  it.each(["pt-BR", "por"])(
    "finds an ungrouped %s course for a Portuguese semantic identity request",
    async (language) => {
      const title = `Engenharia de Software ${randomUUID()}`;

      const [course, request] = await Promise.all([
        courseFixture({
          isPublished: true,
          language,
          normalizedTitle: normalizeString(title),
          organizationId,
          title,
        }),
        generatableCoursePromptFixture({
          canonicalTitle: `Desenvolvimento de Programas ${randomUUID()}`,
          language: "pt",
        }),
      ]);

      assertGeneratableCoursePrompt(request);

      vi.mocked(generateCourseIdentitySearchQueries).mockResolvedValueOnce({
        data: { queries: [title] },
        systemPrompt: "system",
        usage,
        userPrompt: "user",
      });

      vi.mocked(resolveCourseIdentity).mockResolvedValueOnce({
        data: { courseSlug: course.slug, decision: "useExisting", reason: "same discipline" },
        systemPrompt: "system",
        usage,
        userPrompt: "user",
      });

      const result = await resolveCourseIdentityStep(request);

      expect(result?.id).toBe(course.id);
      expect(result?.slug).toBe(course.slug);

      expect(resolveCourseIdentity).toHaveBeenCalledWith(
        expect.objectContaining({
          candidates: expect.arrayContaining([
            expect.objectContaining({ language, slug: course.slug }),
          ]),
        }),
      );
    },
  );

  it.each(["fr", "ja", "pt-??"])(
    "does not reuse a cached or title-matched %s course as Portuguese",
    async (language) => {
      const title = `Different Content Language ${randomUUID()}`;

      const course = await courseFixture({
        isPublished: true,
        language,
        normalizedTitle: normalizeString(title),
        organizationId,
        title,
      });

      const request = await generatableCoursePromptFixture({
        canonicalTitle: title,
        courseId: course.id,
        language: "pt",
      });

      assertGeneratableCoursePrompt(request);

      const result = await resolveCourseIdentityStep(request);

      expect(result).toBeNull();
      expect(resolveCourseIdentity).not.toHaveBeenCalled();
    },
  );

  it("leaves the request unlinked when AI says the candidate is different", async () => {
    const [request] = await Promise.all([
      generatableCoursePromptFixture({ canonicalTitle: "Machine Learning", language: "en" }),
      courseFixture({
        isPublished: true,
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
        isPublished: true,
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
        isPublished: true,
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
      isPublished: true,
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
      isPublished: true,
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
      isPublished: true,
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
      isPublished: true,
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
        isPublished: true,
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
