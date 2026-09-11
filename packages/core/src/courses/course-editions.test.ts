import { randomUUID } from "node:crypto";
import * as canonicalTitleTask from "@zoonk/ai/tasks/courses/canonical-title";
import * as formatTask from "@zoonk/ai/tasks/courses/format";
import * as intentTask from "@zoonk/ai/tasks/courses/intent";
import * as personalizationTask from "@zoonk/ai/tasks/courses/personalization";
import { prisma } from "@zoonk/db";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import { coursePromptFixture } from "@zoonk/testing/fixtures/course-prompts";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { normalizeString } from "@zoonk/utils/string";
import { headers } from "next/headers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCourseEditionPrompt } from "./_utils/edition-prompt";
import { getCourseEditionForPrompt, linkCourseToEditionRequests } from "./course-edition-link";
import { getCourseEdition, resolveCourseEdition } from "./course-editions";
import { getCourseSlugForTitle } from "./course-slug";

// Next request headers are the platform boundary; sessions and persistence are real.
vi.mock("next/headers", () => ({ headers: vi.fn() }));

async function sourceFixture(attrs: Parameters<typeof courseFixture>[0] = {}) {
  const organization = await aiOrganizationFixture();
  const title = attrs?.title ?? `Course editions ${randomUUID()}`;

  return courseFixture({
    isPublished: true,
    normalizedTitle: normalizeString(title),
    organizationId: organization.id,
    title,
    ...attrs,
  });
}

async function authenticate() {
  const user = await userFixture();
  vi.mocked(headers).mockResolvedValue(await signInAs(user.email, user.password));
  return user;
}

/** Only model responses are substituted; the normal resolver and database run. */
function mockClassification(title: string) {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- external AI response fixture
  vi.spyOn(canonicalTitleTask, "generateCanonicalCourseTitle").mockResolvedValue({
    data: { title },
  } as never);
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- external AI response fixture
  vi.spyOn(formatTask, "classifyCourseFormat").mockResolvedValue({
    data: { courseFormat: "core" },
  } as never);
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- external AI response fixture
  vi.spyOn(intentTask, "classifyCourseIntent").mockResolvedValue({
    data: { intent: "learn" },
  } as never);
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- external AI response fixture
  vi.spyOn(personalizationTask, "classifyCoursePersonalization").mockResolvedValue({
    data: { requiresPersonalization: false },
  } as never);
}

describe("course editions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(headers).mockResolvedValue(new Headers());
  });

  it("leaves a matching course and unrelated legacy data untouched", async () => {
    const source = await sourceFixture();

    await expect(getCourseEdition({ courseId: source.id, language: "en" })).resolves.toMatchObject({
      course: { id: source.id, slug: source.slug },
      kind: "course",
    });

    await expect(
      prisma.course.findUniqueOrThrow({ where: { id: source.id } }),
    ).resolves.toMatchObject({ familyId: null });
  });

  it("does not classify, create a family, or prepare generation on a missing public read", async () => {
    const source = await sourceFixture();
    const classify = vi.spyOn(canonicalTitleTask, "generateCanonicalCourseTitle");

    await expect(getCourseEdition({ courseId: source.id, language: "pt" })).resolves.toStrictEqual({
      kind: "missing",
    });

    expect(classify).not.toHaveBeenCalled();

    await expect(
      prisma.courseEditionRequest.count({ where: { sourceCourseId: source.id } }),
    ).resolves.toBe(0);

    await expect(
      prisma.course.findUniqueOrThrow({ where: { id: source.id } }),
    ).resolves.toMatchObject({ familyId: null });

    await expect(
      resolveCourseEdition({ courseId: source.id, language: "pt" }),
    ).resolves.toStrictEqual({ kind: "unauthorized" });

    expect(classify).not.toHaveBeenCalled();
  });

  it("links a previously resolved translated prompt on demand and keeps both slugs", async () => {
    const [source, target, untouched] = await Promise.all([
      sourceFixture(),
      sourceFixture({ language: "pt", slug: `ciencia-da-computacao-${randomUUID()}-pt` }),
      sourceFixture(),
    ]);

    await coursePromptFixture({
      courseId: target.id,
      generationStatus: "completed",
      language: "pt",
      prompt: getCourseEditionPrompt(source),
    });

    await expect(getCourseEdition({ courseId: source.id, language: "pt" })).resolves.toMatchObject({
      course: { id: target.id, slug: target.slug },
      kind: "course",
    });

    const rows = await prisma.course.findMany({
      where: { id: { in: [source.id, target.id, untouched.id] } },
    });

    const original = rows.find((row) => row.id === source.id);
    expect(original?.familyId).toBeTruthy();
    expect(rows.find((row) => row.id === target.id)?.familyId).toBe(original?.familyId);
    expect(rows.find((row) => row.id === untouched.id)?.familyId).toBeNull();
    expect(original?.slug).toBe(source.slug);
  });

  it("preserves source meaning and uses the actual localized slug without reclassifying the course", async () => {
    await authenticate();
    const source = await sourceFixture();
    const title = `Ciência da Computação ${randomUUID()}`;
    const slug = getCourseSlugForTitle({ language: "pt", title });
    const target = await sourceFixture({ language: "pt", slug, title });
    mockClassification(title);
    const result = await resolveCourseEdition({ courseId: source.id, language: "pt" });
    expect(result).toMatchObject({ course: { id: target.id, slug }, kind: "course" });

    expect(canonicalTitleTask.generateCanonicalCourseTitle).toHaveBeenCalledWith({
      language: "pt",
      prompt: getCourseEditionPrompt(source),
    });

    const original = await prisma.course.findUniqueOrThrow({ where: { id: source.id } });

    await expect(
      prisma.course.findUniqueOrThrow({ where: { id: target.id } }),
    ).resolves.toMatchObject({ familyId: original.familyId });

    expect(original.familyId).toBeTruthy();
  });

  it("shares one pending prompt across concurrent requests from different source editions", async () => {
    await authenticate();
    const family = await prisma.courseFamily.create({ data: {} });

    const [english, german] = await Promise.all([
      sourceFixture({ familyId: family.id }),
      sourceFixture({ familyId: family.id, language: "de" }),
    ]);

    mockClassification(`Novo curso ${randomUUID()}`);

    const results = await Promise.all(
      [english, german, english, german].map((source) =>
        resolveCourseEdition({ courseId: source.id, language: "pt" }),
      ),
    );

    expect(results.every((result) => result.kind === "generation")).toBe(true);

    const requests = await prisma.courseEditionRequest.findMany({
      where: { language: "pt", sourceCourse: { familyId: family.id } },
    });

    expect(new Set(requests.map((request) => request.coursePromptId)).size).toBe(1);
    expect(requests).toHaveLength(2);

    expect(
      new Set(
        results.flatMap((result) => (result.kind === "generation" ? [result.coursePromptId] : [])),
      ).size,
    ).toBe(1);

    await expect(
      prisma.course.count({ where: { familyId: family.id, language: "pt" } }),
    ).resolves.toBe(0);
  });

  it("does not mistake a foreign title for an identically spelled English topic", async () => {
    await authenticate();

    const source = await sourceFixture({
      description: "La fabrication du pain, la farine et la fermentation.",
      language: "fr",
      title: `Pain ${randomUUID()}`,
    });

    const wrong = await sourceFixture({
      description: "Understanding physical pain.",
      title: "Pain",
    });

    const title = `Bread ${randomUUID()}`;

    const target = await sourceFixture({
      slug: getCourseSlugForTitle({ language: "en", title }),
      title,
    });

    const unrelatedPrompt = await coursePromptFixture({
      courseId: wrong.id,
      generationStatus: "completed",
      language: "en",
      prompt: source.title,
    });

    await expect(getCourseEdition({ courseId: source.id, language: "en" })).resolves.toStrictEqual({
      kind: "missing",
    });

    mockClassification(title);

    await expect(
      resolveCourseEdition({ courseId: source.id, language: "en" }),
    ).resolves.toMatchObject({ course: { id: target.id }, kind: "course" });

    await expect(
      prisma.coursePrompt.findUniqueOrThrow({ where: { id: unrelatedPrompt.id } }),
    ).resolves.toMatchObject({ courseId: wrong.id });

    await expect(
      prisma.course.findUniqueOrThrow({ where: { id: wrong.id } }),
    ).resolves.toMatchObject({ familyId: null });

    expect(formatTask.classifyCourseFormat).not.toHaveBeenCalled();
    expect(intentTask.classifyCourseIntent).not.toHaveBeenCalled();
    expect(personalizationTask.classifyCoursePersonalization).not.toHaveBeenCalled();
  });

  it("joins an existing regional edition using its original running prompt", async () => {
    const family = await prisma.courseFamily.create({ data: {} });

    const [source, target] = await Promise.all([
      sourceFixture({ familyId: family.id }),
      sourceFixture({
        familyId: family.id,
        generationRunId: "regional-edition-run",
        generationStatus: "running",
        language: "pt-BR",
      }),
    ]);

    const prompt = await coursePromptFixture({
      courseId: target.id,
      generationRunId: target.generationRunId,
      generationStatus: "running",
      language: "pt-BR",
    });

    await expect(getCourseEdition({ courseId: source.id, language: "pt" })).resolves.toStrictEqual({
      coursePromptId: prompt.id,
      generationStatus: "running",
      kind: "generation",
    });
  });

  it.each(["en", "en-US"])(
    "never prepares an English-through-English edition for %s",
    async (language) => {
      await authenticate();

      const source = await sourceFixture({
        format: "language",
        language: "de",
        targetLanguage: "en",
      });

      await expect(resolveCourseEdition({ courseId: source.id, language })).resolves.toStrictEqual({
        kind: "unsupported",
        reason: "sameLanguage",
      });

      await expect(
        prisma.courseEditionRequest.count({ where: { sourceCourseId: source.id } }),
      ).resolves.toBe(0);
    },
  );

  it("stops offering a linked edition after it is unpublished", async () => {
    const [source, target] = await Promise.all([
      sourceFixture(),
      sourceFixture({ isPublished: false, language: "pt" }),
    ]);

    const prompt = await coursePromptFixture({
      courseId: target.id,
      generationStatus: "completed",
      language: "pt",
    });

    await prisma.courseEditionRequest.create({
      data: { coursePromptId: prompt.id, language: "pt", sourceCourseId: source.id },
    });

    await expect(getCourseEdition({ courseId: source.id, language: "pt" })).resolves.toStrictEqual({
      kind: "unsupported",
      reason: "unavailable",
    });
  });

  it("rejects unavailable sources and unsupported locales", async () => {
    const source = await sourceFixture({ isPublished: false });

    await expect(getCourseEdition({ courseId: source.id, language: "pt" })).resolves.toStrictEqual({
      kind: "notFound",
    });

    await expect(
      getCourseEdition({ courseId: source.id, language: "xx-invalid" }),
    ).resolves.toStrictEqual({ kind: "unsupported", reason: "language" });
  });

  it("merges discovered families without dropping duplicate course IDs or pending provenance", async () => {
    const [leftFamily, rightFamily] = await Promise.all([
      prisma.courseFamily.create({ data: {} }),
      prisma.courseFamily.create({ data: {} }),
    ]);

    const [source, duplicate, target] = await Promise.all([
      sourceFixture({ familyId: leftFamily.id }),
      sourceFixture({ familyId: rightFamily.id }),
      sourceFixture({ familyId: rightFamily.id, language: "pt" }),
    ]);

    const [prompt, pending] = await Promise.all([
      coursePromptFixture({ courseId: target.id, language: "pt" }),
      coursePromptFixture({ language: "de" }),
    ]);

    await prisma.courseEditionRequest.createMany({
      data: [
        { coursePromptId: prompt.id, language: "pt", sourceCourseId: source.id },
        { coursePromptId: pending.id, language: "de", sourceCourseId: duplicate.id },
      ],
    });

    await linkCourseToEditionRequests({ courseId: target.id, coursePromptId: prompt.id });

    const rows = await prisma.course.findMany({
      where: { id: { in: [source.id, duplicate.id, target.id] } },
    });

    expect(rows).toHaveLength(3);
    expect(new Set(rows.map((row) => row.familyId)).size).toBe(1);

    await expect(
      prisma.courseEditionRequest.count({ where: { coursePromptId: pending.id } }),
    ).resolves.toBe(1);
  });

  it("uses remaining published sources when an older request source is unpublished", async () => {
    const [removed, source, target] = await Promise.all([
      sourceFixture({ isPublished: false }),
      sourceFixture(),
      sourceFixture({ language: "pt" }),
    ]);

    const prompt = await coursePromptFixture({ language: "pt" });

    await prisma.courseEditionRequest.createMany({
      data: [removed, source].map((course) => ({
        coursePromptId: prompt.id,
        language: "pt",
        sourceCourseId: course.id,
      })),
    });

    const edition = await prisma.$transaction((transaction) =>
      getCourseEditionForPrompt({ coursePromptId: prompt.id, transaction }),
    );

    expect(edition).toMatchObject({ course: null, familyId: expect.any(String) });

    await linkCourseToEditionRequests({ courseId: target.id, coursePromptId: prompt.id });

    const [linked, removedSource] = await Promise.all([
      prisma.course.findUniqueOrThrow({ where: { id: target.id } }),
      prisma.course.findUniqueOrThrow({ where: { id: removed.id } }),
    ]);

    expect(linked.familyId).toBe(edition?.familyId);
    expect(removedSource.familyId).toBeNull();
  });

  it("refuses to initialize an edition after every request source is unpublished", async () => {
    const source = await sourceFixture({ isPublished: false });
    const prompt = await coursePromptFixture({ language: "pt" });

    await prisma.courseEditionRequest.create({
      data: { coursePromptId: prompt.id, language: "pt", sourceCourseId: source.id },
    });

    await expect(
      prisma.$transaction((transaction) =>
        getCourseEditionForPrompt({ coursePromptId: prompt.id, transaction }),
      ),
    ).rejects.toThrow("source course");

    await expect(
      prisma.course.findUniqueOrThrow({ where: { id: source.id } }),
    ).resolves.toMatchObject({ familyId: null });
  });

  it("prepares live provenance when the only family request came from an unpublished source", async () => {
    await authenticate();
    mockClassification(`Published edition ${randomUUID()}`);
    const family = await prisma.courseFamily.create({ data: {} });

    const [removed, source] = await Promise.all([
      sourceFixture({ familyId: family.id, isPublished: false, language: "de" }),
      sourceFixture({ familyId: family.id }),
    ]);

    const stalePrompt = await coursePromptFixture({ language: "pt" });

    await prisma.courseEditionRequest.create({
      data: { coursePromptId: stalePrompt.id, language: "pt", sourceCourseId: removed.id },
    });

    await expect(getCourseEdition({ courseId: source.id, language: "pt" })).resolves.toStrictEqual({
      kind: "missing",
    });

    const result = await resolveCourseEdition({ courseId: source.id, language: "pt" });

    expect(result).toMatchObject({ kind: "generation" });

    const request = await prisma.courseEditionRequest.findUniqueOrThrow({
      where: { sourceLanguage: { language: "pt", sourceCourseId: source.id } },
    });

    expect(request.coursePromptId).not.toBe(stalePrompt.id);
    expect(result).toMatchObject({ coursePromptId: request.coursePromptId });
  });

  it("validates every source sharing a prompt and rolls back incompatible family links", async () => {
    const [source, invalid, target] = await Promise.all([
      sourceFixture(),
      sourceFixture({ format: "language", targetLanguage: "ja" }),
      sourceFixture({ language: "pt" }),
    ]);

    const prompt = await coursePromptFixture({ courseId: target.id, language: "pt" });

    await prisma.courseEditionRequest.createMany({
      data: [source, invalid].map((course) => ({
        coursePromptId: prompt.id,
        language: "pt",
        sourceCourseId: course.id,
      })),
    });

    await expect(
      linkCourseToEditionRequests({ courseId: target.id, coursePromptId: prompt.id }),
    ).rejects.toThrow("does not match");

    await expect(
      prisma.course.findUniqueOrThrow({ where: { id: source.id } }),
    ).resolves.toMatchObject({ familyId: null });
  });

  it("finds a target attached to a later source of a shared prompt before initializing another course", async () => {
    const family = await prisma.courseFamily.create({ data: {} });

    const [source, other, target] = await Promise.all([
      sourceFixture(),
      sourceFixture({ familyId: family.id, language: "de" }),
      sourceFixture({ familyId: family.id, language: "pt" }),
    ]);

    const prompt = await coursePromptFixture({ language: "pt" });

    await prisma.courseEditionRequest.createMany({
      data: [source, other].map((course) => ({
        coursePromptId: prompt.id,
        language: "pt",
        sourceCourseId: course.id,
      })),
    });

    const result = await prisma.$transaction((transaction) =>
      getCourseEditionForPrompt({ coursePromptId: prompt.id, transaction }),
    );

    expect(result).toMatchObject({ course: { id: target.id } });

    await expect(
      prisma.course.findUniqueOrThrow({ where: { id: source.id } }),
    ).resolves.toMatchObject({ familyId: result?.familyId });
  });
});
