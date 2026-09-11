import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { coursePromptFixture } from "@zoonk/testing/fixtures/course-prompts";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { normalizeString } from "@zoonk/utils/string";
import { getCourseEditionPrompt } from "../../../packages/core/src/courses/_utils/edition-prompt";

async function sourceCourseFixture(attrs: Parameters<typeof courseFixture>[0] = {}) {
  const organization = await getAiOrganization();
  const title = attrs.title ?? `Edition source ${randomUUID()}`;

  return courseFixture({
    isPublished: true,
    language: "en",
    normalizedTitle: normalizeString(title),
    organizationId: organization.id,
    title,
    ...attrs,
  });
}

test.describe("Course language editions API", () => {
  test("reads and reuses an existing edition without changing its localized slug", async ({
    request,
  }) => {
    const family = await prisma.courseFamily.create({ data: {} });
    const source = await sourceCourseFixture({ familyId: family.id });

    const edition = await courseFixture({
      familyId: family.id,
      isPublished: true,
      language: "pt-BR",
      organizationId: source.organizationId,
      slug: `ciencia-da-computacao-pt-${randomUUID()}`,
    });

    const path = `/v1/courses/${source.id}/editions`;
    const read = await request.get(`${path}?language=pt`);

    expect(read.status()).toBe(200);
    await expect(read.json()).resolves.toStrictEqual({ courseId: edition.id, kind: "course" });

    const resolved = await request.post(path, { data: { language: "pt" } });

    expect(resolved.status()).toBe(200);

    await expect(resolved.json()).resolves.toStrictEqual({ courseId: edition.id, kind: "course" });

    const course = await request.get(`/v1/courses/${edition.id}`);

    expect(course.status()).toBe(200);
    await expect(course.json()).resolves.toMatchObject({ id: edition.id, slug: edition.slug });
  });

  test("reports a missing edition without preparing generation", async ({ request }) => {
    const source = await sourceCourseFixture();
    const response = await request.get(`/v1/courses/${source.id}/editions?language=pt`);

    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toStrictEqual({ kind: "missing" });

    const [prompt, editionRequest, storedSource] = await Promise.all([
      prisma.coursePrompt.findUnique({
        where: {
          languageNormalizedPrompt: {
            language: "pt",
            normalizedPrompt: normalizeString(getCourseEditionPrompt(source)),
          },
        },
      }),
      prisma.courseEditionRequest.findUnique({
        where: { sourceLanguage: { language: "pt", sourceCourseId: source.id } },
      }),
      prisma.course.findUniqueOrThrow({ where: { id: source.id } }),
    ]);

    expect(prompt).toBeNull();
    expect(editionRequest).toBeNull();
    expect(storedSource.familyId).toBeNull();
  });

  test("stops offering generation destinations after an edition is unpublished", async ({
    request,
  }) => {
    const family = await prisma.courseFamily.create({ data: {} });

    const [source, target] = await Promise.all([
      sourceCourseFixture({ familyId: family.id }),
      sourceCourseFixture({ familyId: family.id, language: "pt" }),
    ]);

    const prompt = await coursePromptFixture({
      courseId: target.id,
      generationStatus: "completed",
      language: "pt",
    });

    await prisma.courseEditionRequest.create({
      data: { coursePromptId: prompt.id, language: "pt", sourceCourseId: source.id },
    });

    const path = `/v1/courses/${source.id}/editions`;
    const available = await request.get(`${path}?language=pt`);

    expect(available.status()).toBe(200);
    await expect(available.json()).resolves.toStrictEqual({ courseId: target.id, kind: "course" });

    await prisma.course.update({ data: { isPublished: false }, where: { id: target.id } });

    const [read, resolved, generation] = await Promise.all([
      request.get(`${path}?language=pt`),
      request.post(path, { data: { language: "pt" } }),
      request.get(`/v1/course-prompts/${prompt.id}`),
    ]);

    expect([read.status(), resolved.status(), generation.status()]).toStrictEqual([200, 200, 404]);

    await expect(read.json()).resolves.toStrictEqual({
      kind: "unsupported",
      reason: "unavailable",
    });

    await expect(resolved.json()).resolves.toStrictEqual({
      kind: "unsupported",
      reason: "unavailable",
    });

    await expect(generation.json()).resolves.toMatchObject({ error: { code: "NOT_FOUND" } });
  });

  test("requires authentication before resolving a missing edition", async ({ request }) => {
    const source = await sourceCourseFixture();

    const response = await request.post(`/v1/courses/${source.id}/editions`, {
      data: { language: "pt" },
    });

    expect(response.status()).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "UNAUTHORIZED" } });

    await expect(
      prisma.courseEditionRequest.findUnique({
        where: { sourceLanguage: { language: "pt", sourceCourseId: source.id } },
      }),
    ).resolves.toBeNull();
  });

  test("reuses an existing generation request without requiring another sign-in", async ({
    request,
  }) => {
    const source = await sourceCourseFixture();

    const prompt = await coursePromptFixture({
      generationStatus: "running",
      language: "pt",
      prompt: source.title,
    });

    await prisma.courseEditionRequest.create({
      data: { coursePromptId: prompt.id, language: "pt", sourceCourseId: source.id },
    });

    const path = `/v1/courses/${source.id}/editions`;

    const responses = await Promise.all([
      request.get(`${path}?language=pt`),
      request.post(path, { data: { language: "pt" } }),
    ]);

    expect(responses.map((response) => response.status())).toStrictEqual([200, 200]);

    const bodies = await Promise.all(responses.map((response) => response.json()));

    const expected = { coursePromptId: prompt.id, generationStatus: "running", kind: "generation" };

    expect(bodies).toStrictEqual([expected, expected]);
  });

  test("suppresses editions taught in the language being learned", async ({ request }) => {
    const source = await sourceCourseFixture({ format: "language", targetLanguage: "pt" });
    const path = `/v1/courses/${source.id}/editions`;

    const responses = await Promise.all([
      request.get(`${path}?language=pt`),
      request.post(path, { data: { language: "pt" } }),
    ]);

    expect(responses.map((response) => response.status())).toStrictEqual([200, 200]);

    const bodies = await Promise.all(responses.map((response) => response.json()));

    expect(bodies).toStrictEqual([
      { kind: "unsupported", reason: "sameLanguage" },
      { kind: "unsupported", reason: "sameLanguage" },
    ]);

    await expect(
      prisma.courseEditionRequest.findUnique({
        where: { sourceLanguage: { language: "pt", sourceCourseId: source.id } },
      }),
    ).resolves.toBeNull();
  });

  test("returns not found for an unpublished source course", async ({ request }) => {
    const source = await sourceCourseFixture({ isPublished: false });
    const path = `/v1/courses/${source.id}/editions`;

    const responses = await Promise.all([
      request.get(`${path}?language=pt`),
      request.post(path, { data: { language: "pt" } }),
    ]);

    expect(responses.map((response) => response.status())).toStrictEqual([404, 404]);

    const bodies = await Promise.all(responses.map((response) => response.json()));

    expect(bodies).toStrictEqual([
      { error: { code: "NOT_FOUND", message: "Course not found" } },
      { error: { code: "NOT_FOUND", message: "Course not found" } },
    ]);
  });

  for (const language of ["it", "pt-BR", ""]) {
    test(`rejects an invalid requested locale: ${language || "empty"}`, async ({ request }) => {
      const path = `/v1/courses/${randomUUID()}/editions`;

      const responses = await Promise.all([
        request.get(`${path}?${new URLSearchParams({ language })}`),
        request.post(path, { data: { language } }),
      ]);

      expect(responses.map((response) => response.status())).toStrictEqual([400, 400]);

      const bodies = await Promise.all(responses.map((response) => response.json()));

      expect(bodies).toMatchObject([
        { error: { code: "VALIDATION_ERROR" } },
        { error: { code: "VALIDATION_ERROR" } },
      ]);
    });
  }
});
