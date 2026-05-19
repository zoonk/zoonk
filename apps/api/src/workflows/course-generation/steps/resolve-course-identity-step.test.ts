import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { resolveCourseIdentity } from "@zoonk/ai/tasks/courses/identity";
import { generateCourseIdentitySearchQueries } from "@zoonk/ai/tasks/courses/identity-search";
import { prisma } from "@zoonk/db";
import { courseSuggestionFixture } from "@zoonk/testing/fixtures/course-suggestions";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { normalizeString, toSlug } from "@zoonk/utils/string";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
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
    const suggestion = await courseSuggestionFixture({ title: `No Candidate ${randomUUID()}` });

    const result = await resolveCourseIdentityStep(suggestion);

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
    const slug = toSlug(title);

    const [course, suggestion] = await Promise.all([
      courseFixture({ organizationId, slug, title }),
      courseSuggestionFixture({ language: "en", slug, title }),
    ]);

    const result = await resolveCourseIdentityStep(suggestion);

    const linkedSuggestion = await prisma.courseSuggestion.findUniqueOrThrow({
      where: { id: suggestion.id },
    });

    expect(result?.id).toBe(course.id);
    expect(linkedSuggestion.courseId).toBe(course.id);
    expect(resolveCourseIdentity).not.toHaveBeenCalled();
  });

  it("uses AI classification to link semantically equivalent course titles", async () => {
    const [course, suggestion] = await Promise.all([
      courseFixture({
        normalizedTitle: normalizeString("Frontend Development"),
        organizationId,
        slug: `frontend-development-${randomUUID()}`,
        title: "Frontend Development",
      }),
      courseSuggestionFixture({
        language: "en",
        slug: `frontend-engineering-${randomUUID()}`,
        title: "Frontend Engineering",
      }),
    ]);

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

    const result = await resolveCourseIdentityStep(suggestion);

    const linkedSuggestion = await prisma.courseSuggestion.findUniqueOrThrow({
      where: { id: suggestion.id },
    });

    expect(result?.id).toBe(course.id);
    expect(linkedSuggestion.courseId).toBe(course.id);

    expect(resolveCourseIdentity).toHaveBeenCalledWith(
      expect.objectContaining({
        candidates: expect.arrayContaining([
          expect.objectContaining({ slug: course.slug, title: "Frontend Development" }),
        ]),
        suggestion: expect.objectContaining({ title: "Frontend Engineering" }),
      }),
    );
  });

  it("leaves the suggestion unlinked when AI says the candidate is different", async () => {
    const [suggestion] = await Promise.all([
      courseSuggestionFixture({
        language: "en",
        slug: `machine-learning-${randomUUID()}`,
        title: "Machine Learning",
      }),
      courseFixture({
        normalizedTitle: normalizeString("Deep Learning"),
        organizationId,
        slug: `deep-learning-${randomUUID()}`,
        title: "Deep Learning",
      }),
    ]);

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

    const result = await resolveCourseIdentityStep(suggestion);

    const linkedSuggestion = await prisma.courseSuggestion.findUniqueOrThrow({
      where: { id: suggestion.id },
    });

    expect(result).toBeNull();
    expect(linkedSuggestion.courseId).toBeNull();
  });

  it("does not split AI search phrases into loose standalone word matches", async () => {
    const [suggestion] = await Promise.all([
      courseSuggestionFixture({
        language: "en",
        slug: `unique-topic-${randomUUID()}`,
        title: "Unique Topic",
      }),
      courseFixture({
        normalizedTitle: normalizeString("Science"),
        organizationId,
        slug: `science-${randomUUID()}`,
        title: "Science",
      }),
    ]);

    vi.mocked(generateCourseIdentitySearchQueries).mockResolvedValueOnce({
      data: { queries: ["data science"] },
      systemPrompt: "system",
      usage,
      userPrompt: "user",
    });

    const result = await resolveCourseIdentityStep(suggestion);

    expect(result).toBeNull();
    expect(resolveCourseIdentity).not.toHaveBeenCalled();
  });

  it("uses the cached course link before querying AI again", async () => {
    const course = await courseFixture({
      organizationId,
      slug: `cached-course-${randomUUID()}`,
      title: "Cached Course",
    });

    const suggestion = await courseSuggestionFixture({
      courseId: course.id,
      title: `Cached Suggestion ${randomUUID()}`,
    });

    const result = await resolveCourseIdentityStep(suggestion);

    expect(result?.id).toBe(course.id);
    expect(resolveCourseIdentity).not.toHaveBeenCalled();
    expect(generateCourseIdentitySearchQueries).not.toHaveBeenCalled();
  });

  it("uses AI search queries before classifying cross-language title matches", async () => {
    const [course, suggestion] = await Promise.all([
      courseFixture({
        language: "pt",
        normalizedTitle: normalizeString("Machine Learning"),
        organizationId,
        slug: `machine-learning-${randomUUID()}-pt`,
        title: "Machine Learning",
      }),
      courseSuggestionFixture({
        language: "pt",
        slug: `aprendizado-de-maquina-${randomUUID()}`,
        title: "Aprendizado de máquina",
      }),
    ]);

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

    const result = await resolveCourseIdentityStep(suggestion);

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
