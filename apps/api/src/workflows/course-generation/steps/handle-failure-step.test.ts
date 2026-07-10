import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { coursePromptFixture } from "@zoonk/testing/fixtures/course-prompts";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { handleChapterFailureStep, handleCourseFailureStep } from "./handle-failure-step";

describe(handleCourseFailureStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks both course and request as failed when courseId is provided", async () => {
    const [course, request] = await Promise.all([
      courseFixture({
        generationRunId: "old-run",
        generationStatus: "running",
        organizationId,
        title: `Fail Course ${randomUUID()}`,
      }),
      coursePromptFixture({
        canonicalTitle: `Fail Request ${randomUUID()}`,
        generationRunId: "old-run",
        generationStatus: "running",
      }),
    ]);

    await handleCourseFailureStep({
      courseId: course.id,
      coursePromptId: request.id,
      workflowRunId: "old-run",
    });

    const [updatedCourse, updatedRequest] = await Promise.all([
      prisma.course.findUniqueOrThrow({ where: { id: course.id } }),
      prisma.coursePrompt.findUniqueOrThrow({ where: { id: request.id } }),
    ]);

    expect(updatedCourse.generationStatus).toBe("failed");
    expect(updatedCourse.generationRunId).toBeNull();
    expect(updatedRequest.generationStatus).toBe("failed");
    expect(updatedRequest.generationRunId).toBeNull();

    const events = getStreamedEvents();

    expect(events).toContainEqual(
      expect.objectContaining({ status: "error", step: "workflowError" }),
    );
  });

  it("marks linked running requests as failed when the course run fails", async () => {
    const course = await courseFixture({
      generationRunId: "old-run",
      generationStatus: "running",
      organizationId,
      title: `Linked Fail Course ${randomUUID()}`,
    });

    const [primaryRequest, linkedRequest] = await Promise.all([
      coursePromptFixture({
        canonicalTitle: `Primary Fail Request ${randomUUID()}`,
        courseId: course.id,
        generationRunId: "old-run",
        generationStatus: "running",
      }),
      coursePromptFixture({
        canonicalTitle: `Linked Fail Request ${randomUUID()}`,
        courseId: course.id,
        generationRunId: "other-run",
        generationStatus: "running",
      }),
    ]);

    await handleCourseFailureStep({
      courseId: course.id,
      coursePromptId: primaryRequest.id,
      workflowRunId: "old-run",
    });

    const updatedLinkedRequest = await prisma.coursePrompt.findUniqueOrThrow({
      where: { id: linkedRequest.id },
    });

    expect(updatedLinkedRequest.generationStatus).toBe("failed");
    expect(updatedLinkedRequest.generationRunId).toBeNull();
  });

  it("re-emits failure when the durable step retries after committing", async () => {
    const workflowRunId = `run-${randomUUID()}`;

    const course = await courseFixture({
      generationRunId: workflowRunId,
      generationStatus: "running",
      organizationId,
    });

    const prompt = await coursePromptFixture({
      courseId: course.id,
      generationRunId: workflowRunId,
      generationStatus: "running",
    });

    const input = { courseId: course.id, coursePromptId: prompt.id, workflowRunId };

    await handleCourseFailureStep(input);
    await handleCourseFailureStep(input);

    const failureEvents = getStreamedEvents().filter(
      (event) => event.status === "error" && event.step === "workflowError",
    );

    expect(failureEvents).toHaveLength(2);
  });

  it("rolls back failure state when a linked state update fails", async () => {
    const course = await courseFixture({
      generationRunId: "active-run",
      generationStatus: "running",
      organizationId,
      title: `Rollback Fail Course ${randomUUID()}`,
    });

    const linkedRequest = await coursePromptFixture({
      canonicalTitle: `Rollback Fail Request ${randomUUID()}`,
      courseId: course.id,
      generationRunId: "active-run",
      generationStatus: "running",
    });

    await expect(
      handleCourseFailureStep({
        courseId: course.id,
        coursePromptId: randomUUID(),
        workflowRunId: "active-run",
      }),
    ).rejects.toThrow();

    const [persistedCourse, persistedLinkedRequest] = await Promise.all([
      prisma.course.findUniqueOrThrow({ where: { id: course.id } }),
      prisma.coursePrompt.findUniqueOrThrow({ where: { id: linkedRequest.id } }),
    ]);

    expect(persistedCourse.generationRunId).toBe("active-run");
    expect(persistedCourse.generationStatus).toBe("running");
    expect(persistedLinkedRequest.generationRunId).toBe("active-run");
    expect(persistedLinkedRequest.generationStatus).toBe("running");
  });

  it("marks only request as failed and clears a stale course link when courseId is null", async () => {
    const course = await courseFixture({ organizationId });

    const request = await coursePromptFixture({
      canonicalTitle: `No Course Fail ${randomUUID()}`,
      courseId: course.id,
      generationRunId: "old-run",
      generationStatus: "running",
    });

    await handleCourseFailureStep({
      courseId: null,
      coursePromptId: request.id,
      workflowRunId: "old-run",
    });

    const updatedRequest = await prisma.coursePrompt.findUniqueOrThrow({
      where: { id: request.id },
    });

    expect(updatedRequest.generationStatus).toBe("failed");
    expect(updatedRequest.generationRunId).toBeNull();
    expect(updatedRequest.courseId).toBeNull();
  });

  it("does not fail a course reclaimed by a newer workflow", async () => {
    const currentWorkflowRunId = `current-${randomUUID()}`;

    const course = await courseFixture({
      generationRunId: currentWorkflowRunId,
      generationStatus: "running",
      organizationId,
    });

    const prompt = await coursePromptFixture({
      courseId: course.id,
      generationRunId: currentWorkflowRunId,
      generationStatus: "running",
    });

    await handleCourseFailureStep({
      courseId: course.id,
      coursePromptId: prompt.id,
      workflowRunId: `stale-${randomUUID()}`,
    });

    const [persistedCourse, persistedPrompt] = await Promise.all([
      prisma.course.findUniqueOrThrow({ where: { id: course.id } }),
      prisma.coursePrompt.findUniqueOrThrow({ where: { id: prompt.id } }),
    ]);

    expect(persistedCourse.generationRunId).toBe(currentWorkflowRunId);
    expect(persistedCourse.generationStatus).toBe("running");
    expect(persistedPrompt.generationRunId).toBe(currentWorkflowRunId);
    expect(persistedPrompt.generationStatus).toBe("running");
  });

  it("does not fail a prompt claimed after an initialization failure", async () => {
    const currentWorkflowRunId = `current-${randomUUID()}`;

    const prompt = await coursePromptFixture({
      generationRunId: currentWorkflowRunId,
      generationStatus: "running",
    });

    await handleCourseFailureStep({
      courseId: null,
      coursePromptId: prompt.id,
      workflowRunId: `stale-${randomUUID()}`,
    });

    const persistedPrompt = await prisma.coursePrompt.findUniqueOrThrow({
      where: { id: prompt.id },
    });

    expect(persistedPrompt.generationRunId).toBe(currentWorkflowRunId);
    expect(persistedPrompt.generationStatus).toBe("running");
  });

  it("does not downgrade a completed prompt without a run id", async () => {
    const course = await courseFixture({ organizationId });

    const prompt = await coursePromptFixture({
      courseId: course.id,
      generationRunId: null,
      generationStatus: "completed",
    });

    await handleCourseFailureStep({
      courseId: null,
      coursePromptId: prompt.id,
      workflowRunId: `stale-${randomUUID()}`,
    });

    const persistedPrompt = await prisma.coursePrompt.findUniqueOrThrow({
      where: { id: prompt.id },
    });

    expect(persistedPrompt.courseId).toBe(course.id);
    expect(persistedPrompt.generationRunId).toBeNull();
    expect(persistedPrompt.generationStatus).toBe("completed");
  });
});

describe(handleChapterFailureStep, () => {
  let organizationId: string;
  let courseId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId });
    courseId = course.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks chapter as failed and clears run ID", async () => {
    const chapter = await chapterFixture({
      courseId,
      generationRunId: "old-run",
      generationStatus: "running",
      organizationId,
      title: `Fail Chapter ${randomUUID()}`,
    });

    await handleChapterFailureStep({ chapterId: chapter.id });

    const updated = await prisma.chapter.findUniqueOrThrow({ where: { id: chapter.id } });

    expect(updated.generationStatus).toBe("failed");
    expect(updated.generationRunId).toBeNull();

    const events = getStreamedEvents();

    expect(events).toContainEqual(
      expect.objectContaining({ status: "error", step: "workflowError" }),
    );
  });
});
