import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { captureException, flush } from "@sentry/nextjs";
import { prisma } from "@zoonk/db";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createLessonContext } from "./_test-utils/create-lesson-context";
import { handleLessonFailureStep } from "./handle-failure-step";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), flush: vi.fn() }));
vi.mock("@zoonk/utils/logger", () => ({ logError: vi.fn() }));

describe(handleLessonFailureStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  it("marks a lesson as failed after workflow failure", async () => {
    const lesson = await createLessonContext({ generationStatus: "running", organizationId });

    await prisma.lesson.update({
      data: { generationRunId: "failed-run" },
      where: { id: lesson.id },
    });

    await handleLessonFailureStep({
      error: { message: "AI failed", name: "Error", stack: "stack" },
      lessonId: lesson.id,
      workflowRunId: "failed-run",
    });

    const updatedLesson = await prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } });

    expect(updatedLesson.generationStatus).toBe("failed");

    expect(getStreamedEvents()).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reason: "aiGenerationFailed",
          status: "error",
          step: "workflowError",
        }),
      ]),
    );

    const capturedError = vi.mocked(captureException).mock.calls[0]?.[0] as Error;

    expect(capturedError.message).toBe("AI failed");
    expect(capturedError.name).toBe("Error");
    expect(capturedError.stack).toBe("stack");

    expect(captureException).toHaveBeenCalledWith(
      capturedError,
      expect.objectContaining({
        contexts: expect.objectContaining({
          workflow: expect.objectContaining({
            entity: "lesson",
            entityId: lesson.id,
            name: "lessonGenerationWorkflow",
          }),
        }),
        tags: expect.objectContaining({ "workflow.name": "lessonGenerationWorkflow" }),
      }),
    );

    expect(flush).toHaveBeenCalledWith(2000);
  });

  it("fails only the root lesson owned by the workflow", async () => {
    const workflowRunId = "group-failure-run";
    const lesson = await createLessonContext({ generationStatus: "running", organizationId });

    const [additionalLesson, otherRunLesson] = await Promise.all([
      lessonFixture({
        chapterId: lesson.chapterId,
        generationRunId: workflowRunId,
        generationStatus: "running",
        isPublished: false,
        kind: "alphabet",
        organizationId,
      }),
      lessonFixture({
        chapterId: lesson.chapterId,
        generationRunId: "other-running-workflow",
        generationStatus: "running",
        isPublished: true,
        kind: "grammar",
        organizationId,
      }),
    ]);

    await prisma.lesson.update({
      data: { generationRunId: workflowRunId },
      where: { id: lesson.id },
    });

    await handleLessonFailureStep({ lessonId: lesson.id, workflowRunId });

    const [source, additional, otherRun] = await Promise.all([
      prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } }),
      prisma.lesson.findUniqueOrThrow({ where: { id: additionalLesson.id } }),
      prisma.lesson.findUniqueOrThrow({ where: { id: otherRunLesson.id } }),
    ]);

    expect(source.generationStatus).toBe("failed");
    expect(additional.generationStatus).toBe("running");
    expect(otherRun.generationStatus).toBe("running");
  });

  it("does not downgrade a lesson completed before failure handling", async () => {
    const workflowRunId = "completed-run";
    const lesson = await createLessonContext({ generationStatus: "running", organizationId });

    await prisma.lesson.update({
      data: { generationRunId: workflowRunId, generationStatus: "completed" },
      where: { id: lesson.id },
    });

    await handleLessonFailureStep({ lessonId: lesson.id, workflowRunId });

    await expect(
      prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } }),
    ).resolves.toMatchObject({ generationRunId: workflowRunId, generationStatus: "completed" });
  });
});
