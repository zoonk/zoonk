import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { resolveCourseIdentity } from "@zoonk/ai/tasks/courses/identity";
import { generateCourseIdentitySearchQueries } from "@zoonk/ai/tasks/courses/identity-search";
import { getCourseSlugForTitle } from "@zoonk/core/courses/slug";
import { prisma } from "@zoonk/db";
import { generatableCourseStartRequestFixture } from "@zoonk/testing/fixtures/course-start-requests";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { normalizeString } from "@zoonk/utils/string";
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
    const request = await generatableCourseStartRequestFixture({
      canonicalTitle: `No Candidate ${randomUUID()}`,
    });

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
      generatableCourseStartRequestFixture({ canonicalTitle: title, language: "en" }),
    ]);

    const result = await resolveCourseIdentityStep(request);

    const linkedRequest = await prisma.courseStartRequest.findUniqueOrThrow({
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
      generatableCourseStartRequestFixture({
        canonicalTitle: "Frontend Engineering",
        language: "en",
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

    const result = await resolveCourseIdentityStep(request);

    const linkedRequest = await prisma.courseStartRequest.findUniqueOrThrow({
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
      generatableCourseStartRequestFixture({ canonicalTitle: "Machine Learning", language: "en" }),
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

    const result = await resolveCourseIdentityStep(request);

    const linkedRequest = await prisma.courseStartRequest.findUniqueOrThrow({
      where: { id: request.id },
    });

    expect(result).toBeNull();
    expect(linkedRequest.courseId).toBeNull();
  });

  it("does not split AI search phrases into loose standalone word matches", async () => {
    const [request] = await Promise.all([
      generatableCourseStartRequestFixture({ canonicalTitle: "Unique Topic", language: "en" }),
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

    const result = await resolveCourseIdentityStep(request);

    expect(result).toBeNull();
    expect(resolveCourseIdentity).not.toHaveBeenCalled();
  });

  it("ignores short AI search terms that would create noisy substring matches", async () => {
    const [request] = await Promise.all([
      generatableCourseStartRequestFixture({
        canonicalTitle: "Aprendizado de Máquina",
        language: "pt",
      }),
      courseFixture({
        language: "pt",
        normalizedTitle: normalizeString("Inteligência Artificial"),
        organizationId,
        slug: `inteligencia-artificial-${randomUUID()}-pt`,
        title: "Inteligência Artificial",
      }),
    ]);

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

    const request = await generatableCourseStartRequestFixture({
      canonicalTitle: `Cached Request ${randomUUID()}`,
      courseId: course.id,
    });

    const result = await resolveCourseIdentityStep(request);

    expect(result?.id).toBe(course.id);
    expect(resolveCourseIdentity).not.toHaveBeenCalled();
    expect(generateCourseIdentitySearchQueries).not.toHaveBeenCalled();
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
      generatableCourseStartRequestFixture({
        canonicalTitle: "Aprendizado de máquina",
        language: "pt",
        prompt: `Aprendizado de máquina ${randomUUID()}`,
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
