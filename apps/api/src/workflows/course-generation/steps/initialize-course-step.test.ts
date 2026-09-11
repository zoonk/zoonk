import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { getCourseSlugForTitle } from "@zoonk/core/courses/slug";
import { prisma } from "@zoonk/db";
import { generatableCoursePromptFixture } from "@zoonk/testing/fixtures/course-prompts";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { assertGeneratableCoursePrompt } from "./get-course-prompt-step";
import { initializeCourseStep } from "./initialize-course-step";

describe(initializeCourseStep, () => {
  beforeAll(async () => {
    await aiOrganizationFixture();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws without streaming error when request update fails", async () => {
    const request = await generatableCoursePromptFixture({
      canonicalTitle: `Missing Request ${randomUUID()}`,
    });

    assertGeneratableCoursePrompt(request);

    const fakeRequest = {
      ...request,
      canonicalTitle: `Nonexistent ${randomUUID()}`,
      id: randomUUID(),
    };

    await expect(
      initializeCourseStep({ request: fakeRequest, workflowRunId: "run-id" }),
    ).rejects.toThrow();

    const courses = await prisma.course.findMany({ where: { title: fakeRequest.canonicalTitle } });

    expect(courses).toHaveLength(0);

    const events = getStreamedEvents();

    expect(events).not.toContainEqual(
      expect.objectContaining({ status: "error", step: "initializeCourse" }),
    );
  });

  it("creates a course and marks request as running", async () => {
    const request = await generatableCoursePromptFixture({
      canonicalTitle: `Init Course ${randomUUID()}`,
    });

    assertGeneratableCoursePrompt(request);

    const workflowRunId = `run-${randomUUID()}`;

    const result = await initializeCourseStep({ request, workflowRunId });

    expect(result.course.courseTitle).toBe(request.canonicalTitle);
    expect(result.course.format).toBe("core");
    expect(result.course.language).toBe(request.language);
    expect(result.course.courseId).toStrictEqual(expect.any(String));
    expect(result.existing).toBeNull();

    const [updatedRequest, createdCourse] = await Promise.all([
      prisma.coursePrompt.findUniqueOrThrow({ where: { id: request.id } }),
      prisma.course.findUniqueOrThrow({ where: { id: result.course.courseId } }),
    ]);

    expect(updatedRequest.generationStatus).toBe("running");
    expect(updatedRequest.generationRunId).toBe(workflowRunId);
    expect(updatedRequest.courseId).toBe(result.course.courseId);
    expect(createdCourse.generationStatus).toBe("running");
    expect(createdCourse.isPublished).toBe(true);
    expect(createdCourse.title).toBe(request.canonicalTitle);

    const events = getStreamedEvents();

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "initializeCourse" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "initializeCourse" }),
    );
  });

  it("sets targetLanguage on course when request has one", async () => {
    const request = await generatableCoursePromptFixture({
      canonicalTitle: `Language Course ${randomUUID()}`,
      courseFormat: "language",
      targetLanguage: "es",
    });

    assertGeneratableCoursePrompt(request);

    const result = await initializeCourseStep({ request, workflowRunId: `run-${randomUUID()}` });

    expect(result.course.targetLanguage).toBe("es");
    expect(result.course.format).toBe("language");

    const course = await prisma.course.findUniqueOrThrow({ where: { id: result.course.courseId } });

    expect(course.targetLanguage).toBe("es");
  });

  it("defers recovered prompt reconciliation to the atomic course claim", async () => {
    const organization = await aiOrganizationFixture();
    const canonicalTitle = `Recovered Course ${randomUUID()}`;
    const request = await generatableCoursePromptFixture({ canonicalTitle });

    assertGeneratableCoursePrompt(request);

    const winningWorkflowRunId = `winning-${randomUUID()}`;

    const existingCourse = await courseFixture({
      generationRunId: winningWorkflowRunId,
      generationStatus: "running",
      isPublished: true,
      language: request.language,
      organizationId: organization.id,
      slug: getCourseSlugForTitle({ language: request.language, title: canonicalTitle }),
      title: canonicalTitle,
    });

    const result = await initializeCourseStep({ request, workflowRunId: `losing-${randomUUID()}` });

    const persistedPrompt = await prisma.coursePrompt.findUniqueOrThrow({
      where: { id: request.id },
    });

    expect(result.course.courseId).toBe(existingCourse.id);
    expect(result.existing).not.toBeNull();
    expect(persistedPrompt.courseId).toBeNull();
    expect(persistedPrompt.generationRunId).toBeNull();
    expect(persistedPrompt.generationStatus).toBe("pending");
  });

  it("creates only one family edition when equivalent prompts have different translated titles", async () => {
    const organization = await aiOrganizationFixture();
    const family = await prisma.courseFamily.create({ data: {} });

    const [englishCourse, spanishCourse] = await Promise.all([
      courseFixture({
        familyId: family.id,
        isPublished: true,
        language: "en",
        organizationId: organization.id,
      }),
      courseFixture({
        familyId: family.id,
        isPublished: true,
        language: "es",
        organizationId: organization.id,
      }),
    ]);

    const [firstPrompt, secondPrompt] = await Promise.all([
      generatableCoursePromptFixture({
        canonicalTitle: `Computação ${randomUUID()}`,
        language: "pt",
      }),
      generatableCoursePromptFixture({
        canonicalTitle: `Ciência da Computação ${randomUUID()}`,
        language: "pt",
      }),
    ]);

    assertGeneratableCoursePrompt(firstPrompt);
    assertGeneratableCoursePrompt(secondPrompt);

    await prisma.courseEditionRequest.createMany({
      data: [
        { coursePromptId: firstPrompt.id, language: "pt", sourceCourseId: englishCourse.id },
        { coursePromptId: secondPrompt.id, language: "pt", sourceCourseId: spanishCourse.id },
      ],
    });

    const [first, second] = await Promise.all([
      initializeCourseStep({ request: firstPrompt, workflowRunId: `first-${randomUUID()}` }),
      initializeCourseStep({ request: secondPrompt, workflowRunId: `second-${randomUUID()}` }),
    ]);

    const editions = await prisma.course.findMany({
      where: { familyId: family.id, language: "pt" },
    });

    expect(editions).toHaveLength(1);
    expect(first.course.courseId).toBe(second.course.courseId);
    expect([first, second].filter((result) => result.existing === null)).toHaveLength(1);
    expect(editions[0]?.slug).toBe(first.course.courseSlug);
    expect(editions[0]?.slug).toMatch(/-pt$/u);
  });

  it("rejects a hidden same-slug course without exposing it or linking the prompt", async () => {
    const organization = await aiOrganizationFixture();
    const title = `Hidden Slug ${randomUUID()}`;

    const [hidden, request] = await Promise.all([
      courseFixture({
        generationStatus: "completed",
        isPublished: false,
        language: "pt",
        organizationId: organization.id,
        slug: getCourseSlugForTitle({ language: "pt", title }),
        title,
      }),
      generatableCoursePromptFixture({ canonicalTitle: title, language: "pt" }),
    ]);

    assertGeneratableCoursePrompt(request);

    await expect(
      initializeCourseStep({ request, workflowRunId: `hidden-${randomUUID()}` }),
    ).rejects.toThrow("Course is not published");

    const [persistedCourse, persistedPrompt] = await Promise.all([
      prisma.course.findUniqueOrThrow({ where: { id: hidden.id } }),
      prisma.coursePrompt.findUniqueOrThrow({ where: { id: request.id } }),
    ]);

    expect(persistedCourse.isPublished).toBe(false);
    expect(persistedCourse.generationStatus).toBe("completed");
    expect(persistedPrompt.courseId).toBeNull();
    expect(persistedPrompt.generationStatus).toBe("pending");
  });

  it("rejects an edition prompt that changes the language being learned before creating a course", async () => {
    const organization = await aiOrganizationFixture();

    const source = await courseFixture({
      format: "language",
      isPublished: true,
      language: "en",
      organizationId: organization.id,
      targetLanguage: "ja",
    });

    const request = await generatableCoursePromptFixture({
      canonicalTitle: `Different target ${randomUUID()}`,
      courseFormat: "language",
      language: "pt",
      targetLanguage: "fr",
    });

    assertGeneratableCoursePrompt(request);

    await prisma.courseEditionRequest.create({
      data: { coursePromptId: request.id, language: "pt", sourceCourseId: source.id },
    });

    await expect(
      initializeCourseStep({ request, workflowRunId: `invalid-${randomUUID()}` }),
    ).rejects.toThrow();

    const [persistedPrompt, courses] = await Promise.all([
      prisma.coursePrompt.findUniqueOrThrow({ where: { id: request.id } }),
      prisma.course.findMany({ where: { title: request.canonicalTitle } }),
    ]);

    expect(persistedPrompt.courseId).toBeNull();
    expect(courses).toHaveLength(0);
  });
});
