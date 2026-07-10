import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { prisma } from "@zoonk/db";
import { coursePromptFixture } from "@zoonk/testing/fixtures/course-prompts";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { completeCourseSetupStep } from "./complete-course-setup-step";

describe(completeCourseSetupStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rolls back completion when a linked state update fails", async () => {
    const workflowRunId = `run-${randomUUID()}`;

    const course = await courseFixture({
      generationRunId: workflowRunId,
      generationStatus: "running",
      organizationId,
      title: `Rollback Complete Setup ${randomUUID()}`,
    });

    const linkedRequest = await coursePromptFixture({
      canonicalTitle: `Rollback Linked Request ${randomUUID()}`,
      courseId: course.id,
      generationStatus: "running",
    });

    await expect(
      completeCourseSetupStep({
        courseId: course.id,
        coursePromptId: randomUUID(),
        courseSlug: course.slug,
        workflowRunId,
      }),
    ).rejects.toThrow();

    const [persistedCourse, persistedLinkedRequest] = await Promise.all([
      prisma.course.findUniqueOrThrow({ where: { id: course.id } }),
      prisma.coursePrompt.findUniqueOrThrow({ where: { id: linkedRequest.id } }),
    ]);

    expect(persistedCourse.generationStatus).toBe("running");
    expect(persistedLinkedRequest.generationStatus).toBe("running");

    const events = getStreamedEvents();

    expect(events).not.toContainEqual(
      expect.objectContaining({ status: "error", step: "completeCourseSetup" }),
    );
  });

  it("marks both course and request as completed", async () => {
    const workflowRunId = `run-${randomUUID()}`;

    const [course, request] = await Promise.all([
      courseFixture({
        generationRunId: workflowRunId,
        generationStatus: "running",
        organizationId,
        title: `Complete Setup ${randomUUID()}`,
      }),
      coursePromptFixture({
        canonicalTitle: `Complete Request ${randomUUID()}`,
        generationStatus: "running",
      }),
    ]);

    await completeCourseSetupStep({
      courseId: course.id,
      coursePromptId: request.id,
      courseSlug: course.slug,
      workflowRunId,
    });

    const [updatedCourse, updatedRequest] = await Promise.all([
      prisma.course.findUniqueOrThrow({ where: { id: course.id } }),
      prisma.coursePrompt.findUniqueOrThrow({ where: { id: request.id } }),
    ]);

    expect(updatedCourse.generationStatus).toBe("completed");
    expect(updatedRequest.generationStatus).toBe("completed");
    expect(updatedRequest.courseId).toBe(course.id);

    const events = getStreamedEvents();

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "completeCourseSetup" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({
        entityId: course.slug,
        status: "completed",
        step: "completeCourseSetup",
      }),
    );
  });

  it("marks linked requests as completed when another run finishes the course", async () => {
    const workflowRunId = `run-${randomUUID()}`;

    const course = await courseFixture({
      generationRunId: workflowRunId,
      generationStatus: "running",
      organizationId,
      title: `Linked Complete Setup ${randomUUID()}`,
    });

    const [primaryRequest, linkedRequest] = await Promise.all([
      coursePromptFixture({
        canonicalTitle: `Primary Complete Request ${randomUUID()}`,
        courseId: course.id,
        generationStatus: "running",
      }),
      coursePromptFixture({
        canonicalTitle: `Linked Complete Request ${randomUUID()}`,
        courseId: course.id,
        generationRunId: "other-run",
        generationStatus: "running",
      }),
    ]);

    await completeCourseSetupStep({
      courseId: course.id,
      coursePromptId: primaryRequest.id,
      courseSlug: course.slug,
      workflowRunId,
    });

    const updatedLinkedRequest = await prisma.coursePrompt.findUniqueOrThrow({
      where: { id: linkedRequest.id },
    });

    expect(updatedLinkedRequest.generationStatus).toBe("completed");
  });

  it("re-emits completion when the durable step retries after committing", async () => {
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

    const input = {
      courseId: course.id,
      coursePromptId: prompt.id,
      courseSlug: course.slug,
      workflowRunId,
    };

    await completeCourseSetupStep(input);
    await completeCourseSetupStep(input);

    const completionEvents = getStreamedEvents().filter(
      (event) => event.entityId === course.slug && event.status === "completed",
    );

    expect(completionEvents).toHaveLength(2);
  });

  it("does not complete a course reclaimed by a newer workflow", async () => {
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

    await completeCourseSetupStep({
      courseId: course.id,
      coursePromptId: prompt.id,
      courseSlug: course.slug,
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
});
