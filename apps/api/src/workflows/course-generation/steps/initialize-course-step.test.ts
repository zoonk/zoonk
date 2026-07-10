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
});
