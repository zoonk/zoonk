import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { prisma } from "@zoonk/db";
import { coursePromptFixture } from "@zoonk/testing/fixtures/course-prompts";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { completeCourseSetupStep } from "./complete-course-setup-step";
import { setCourseAsRunningStep } from "./set-course-as-running-step";

describe(setCourseAsRunningStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rolls back the claim when the prompt cannot be reconciled", async () => {
    const course = await courseFixture({
      generationRunId: null,
      generationStatus: "failed",
      organizationId,
    });

    await expect(
      setCourseAsRunningStep({
        courseId: course.id,
        coursePromptId: randomUUID(),
        workflowRunId: `run-${randomUUID()}`,
      }),
    ).rejects.toThrow();

    const persistedCourse = await prisma.course.findUniqueOrThrow({ where: { id: course.id } });

    expect(persistedCourse.generationRunId).toBeNull();
    expect(persistedCourse.generationStatus).toBe("failed");

    const events = getStreamedEvents();

    expect(events).not.toContainEqual(
      expect.objectContaining({ status: "error", step: "setCourseAsRunning" }),
    );
  });

  it("claims a failed course and reconciles the prompt", async () => {
    const [course, request] = await Promise.all([
      courseFixture({
        generationRunId: null,
        generationStatus: "failed",
        organizationId,
        title: `Set Running ${randomUUID()}`,
      }),
      coursePromptFixture({ canonicalTitle: `Running Request ${randomUUID()}` }),
    ]);

    const workflowRunId = `run-${randomUUID()}`;

    const status = await setCourseAsRunningStep({
      courseId: course.id,
      coursePromptId: request.id,
      workflowRunId,
    });

    expect(status).toBe("ready");

    const [updatedCourse, updatedRequest] = await Promise.all([
      prisma.course.findUniqueOrThrow({ where: { id: course.id } }),
      prisma.coursePrompt.findUniqueOrThrow({ where: { id: request.id } }),
    ]);

    expect(updatedCourse.generationRunId).toBe(workflowRunId);
    expect(updatedCourse.generationStatus).toBe("running");
    expect(updatedRequest.courseId).toBe(course.id);
    expect(updatedRequest.generationStatus).toBe("running");
    expect(updatedRequest.generationRunId).toBe(workflowRunId);

    const events = getStreamedEvents();

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "setCourseAsRunning" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "setCourseAsRunning" }),
    );
  });

  it("continues when the current workflow already owns the running course", async () => {
    const workflowRunId = `run-${randomUUID()}`;

    const [course, request] = await Promise.all([
      courseFixture({
        generationRunId: workflowRunId,
        generationStatus: "running",
        organizationId,
      }),
      coursePromptFixture({ canonicalTitle: `Current Owner ${randomUUID()}` }),
    ]);

    const status = await setCourseAsRunningStep({
      courseId: course.id,
      coursePromptId: request.id,
      workflowRunId,
    });

    expect(status).toBe("ready");

    const persistedPrompt = await prisma.coursePrompt.findUniqueOrThrow({
      where: { id: request.id },
    });

    expect(persistedPrompt.courseId).toBe(course.id);
    expect(persistedPrompt.generationRunId).toBe(workflowRunId);
    expect(persistedPrompt.generationStatus).toBe("running");
  });

  it("keeps another running owner and reconciles the prompt to that run", async () => {
    const winningWorkflowRunId = `winning-${randomUUID()}`;

    const [course, request] = await Promise.all([
      courseFixture({
        generationRunId: winningWorkflowRunId,
        generationStatus: "running",
        organizationId,
      }),
      coursePromptFixture({ canonicalTitle: `Other Owner ${randomUUID()}` }),
    ]);

    const status = await setCourseAsRunningStep({
      courseId: course.id,
      coursePromptId: request.id,
      workflowRunId: `losing-${randomUUID()}`,
    });

    expect(status).toBe("running");

    const [persistedCourse, persistedPrompt] = await Promise.all([
      prisma.course.findUniqueOrThrow({ where: { id: course.id } }),
      prisma.coursePrompt.findUniqueOrThrow({ where: { id: request.id } }),
    ]);

    expect(persistedCourse.generationRunId).toBe(winningWorkflowRunId);
    expect(persistedCourse.generationStatus).toBe("running");
    expect(persistedPrompt.courseId).toBe(course.id);
    expect(persistedPrompt.generationRunId).toBe(winningWorkflowRunId);
    expect(persistedPrompt.generationStatus).toBe("running");
  });

  it("keeps a completed course and completes the prompt", async () => {
    const winningWorkflowRunId = `completed-${randomUUID()}`;

    const [course, request] = await Promise.all([
      courseFixture({
        generationRunId: winningWorkflowRunId,
        generationStatus: "completed",
        organizationId,
      }),
      coursePromptFixture({ canonicalTitle: `Completed Owner ${randomUUID()}` }),
    ]);

    const status = await setCourseAsRunningStep({
      courseId: course.id,
      coursePromptId: request.id,
      workflowRunId: `losing-${randomUUID()}`,
    });

    expect(status).toBe("completed");

    const [persistedCourse, persistedPrompt] = await Promise.all([
      prisma.course.findUniqueOrThrow({ where: { id: course.id } }),
      prisma.coursePrompt.findUniqueOrThrow({ where: { id: request.id } }),
    ]);

    expect(persistedCourse.generationRunId).toBe(winningWorkflowRunId);
    expect(persistedCourse.generationStatus).toBe("completed");
    expect(persistedPrompt.courseId).toBe(course.id);
    expect(persistedPrompt.generationRunId).toBe(winningWorkflowRunId);
    expect(persistedPrompt.generationStatus).toBe("completed");
  });

  it("keeps the prompt completed when completion races reconciliation", async () => {
    const winningWorkflowRunId = `winning-${randomUUID()}`;

    const course = await courseFixture({
      generationRunId: winningWorkflowRunId,
      generationStatus: "running",
      organizationId,
    });

    const [winningPrompt, recoveredPrompt] = await Promise.all([
      coursePromptFixture({
        courseId: course.id,
        generationRunId: winningWorkflowRunId,
        generationStatus: "running",
      }),
      coursePromptFixture({ canonicalTitle: `Recovered Prompt ${randomUUID()}` }),
    ]);

    await Promise.all([
      setCourseAsRunningStep({
        courseId: course.id,
        coursePromptId: recoveredPrompt.id,
        workflowRunId: `losing-${randomUUID()}`,
      }),
      completeCourseSetupStep({
        courseId: course.id,
        coursePromptId: winningPrompt.id,
        courseSlug: course.slug,
        workflowRunId: winningWorkflowRunId,
      }),
    ]);

    const [persistedCourse, persistedRecoveredPrompt] = await Promise.all([
      prisma.course.findUniqueOrThrow({ where: { id: course.id } }),
      prisma.coursePrompt.findUniqueOrThrow({ where: { id: recoveredPrompt.id } }),
    ]);

    expect(persistedCourse.generationStatus).toBe("completed");
    expect(persistedRecoveredPrompt.courseId).toBe(course.id);
    expect(persistedRecoveredPrompt.generationRunId).toBe(winningWorkflowRunId);
    expect(persistedRecoveredPrompt.generationStatus).toBe("completed");
  });

  it.each(["failed", "pending"] as const)(
    "lets only one workflow claim a %s course",
    async (generationStatus) => {
      const course = await courseFixture({
        generationRunId: null,
        generationStatus,
        organizationId,
      });

      const [firstPrompt, secondPrompt] = await Promise.all([
        coursePromptFixture({ canonicalTitle: `First Claim ${randomUUID()}` }),
        coursePromptFixture({ canonicalTitle: `Second Claim ${randomUUID()}` }),
      ]);

      const firstWorkflowRunId = `first-${randomUUID()}`;
      const secondWorkflowRunId = `second-${randomUUID()}`;

      const [firstStatus, secondStatus] = await Promise.all([
        setCourseAsRunningStep({
          courseId: course.id,
          coursePromptId: firstPrompt.id,
          workflowRunId: firstWorkflowRunId,
        }),
        setCourseAsRunningStep({
          courseId: course.id,
          coursePromptId: secondPrompt.id,
          workflowRunId: secondWorkflowRunId,
        }),
      ]);

      expect([firstStatus, secondStatus].toSorted()).toStrictEqual(["ready", "running"]);

      const [persistedCourse, persistedFirstPrompt, persistedSecondPrompt] = await Promise.all([
        prisma.course.findUniqueOrThrow({ where: { id: course.id } }),
        prisma.coursePrompt.findUniqueOrThrow({ where: { id: firstPrompt.id } }),
        prisma.coursePrompt.findUniqueOrThrow({ where: { id: secondPrompt.id } }),
      ]);

      expect([firstWorkflowRunId, secondWorkflowRunId]).toContain(persistedCourse.generationRunId);
      expect(persistedCourse.generationStatus).toBe("running");
      expect(persistedFirstPrompt.generationRunId).toBe(persistedCourse.generationRunId);
      expect(persistedSecondPrompt.generationRunId).toBe(persistedCourse.generationRunId);
    },
  );

  it("restores the current owner from a linked prompt when a running course has no run id", async () => {
    const workflowRunId = `current-${randomUUID()}`;

    const course = await courseFixture({
      generationRunId: null,
      generationStatus: "running",
      organizationId,
    });

    const prompt = await coursePromptFixture({
      courseId: course.id,
      generationRunId: workflowRunId,
      generationStatus: "running",
    });

    const status = await setCourseAsRunningStep({
      courseId: course.id,
      coursePromptId: prompt.id,
      workflowRunId,
    });

    const persistedCourse = await prisma.course.findUniqueOrThrow({ where: { id: course.id } });

    expect(status).toBe("ready");
    expect(persistedCourse.generationRunId).toBe(workflowRunId);
    expect(persistedCourse.generationStatus).toBe("running");
  });

  it("preserves a linked owner when a running course has no run id", async () => {
    const winningWorkflowRunId = `winning-${randomUUID()}`;

    const course = await courseFixture({
      generationRunId: null,
      generationStatus: "running",
      organizationId,
    });

    const [winningPrompt, losingPrompt] = await Promise.all([
      coursePromptFixture({
        courseId: course.id,
        generationRunId: winningWorkflowRunId,
        generationStatus: "running",
      }),
      coursePromptFixture(),
    ]);

    const status = await setCourseAsRunningStep({
      courseId: course.id,
      coursePromptId: losingPrompt.id,
      workflowRunId: `losing-${randomUUID()}`,
    });

    const [persistedCourse, persistedLosingPrompt] = await Promise.all([
      prisma.course.findUniqueOrThrow({ where: { id: course.id } }),
      prisma.coursePrompt.findUniqueOrThrow({ where: { id: losingPrompt.id } }),
    ]);

    expect(status).toBe("running");
    expect(persistedCourse.generationRunId).toBe(winningWorkflowRunId);
    expect(persistedLosingPrompt.courseId).toBe(course.id);
    expect(persistedLosingPrompt.generationRunId).toBe(winningPrompt.generationRunId);
    expect(persistedLosingPrompt.generationStatus).toBe("running");
  });

  it("claims an abandoned running course with no linked owner", async () => {
    const course = await courseFixture({
      generationRunId: null,
      generationStatus: "running",
      organizationId,
    });

    const prompt = await coursePromptFixture();
    const workflowRunId = `claim-${randomUUID()}`;

    const status = await setCourseAsRunningStep({
      courseId: course.id,
      coursePromptId: prompt.id,
      workflowRunId,
    });

    const persistedCourse = await prisma.course.findUniqueOrThrow({ where: { id: course.id } });

    expect(status).toBe("ready");
    expect(persistedCourse.generationRunId).toBe(workflowRunId);
    expect(persistedCourse.generationStatus).toBe("running");
  });
});
