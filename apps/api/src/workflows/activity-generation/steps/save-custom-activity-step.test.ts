import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { assertStepContent } from "@zoonk/core/steps/content-contract";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { saveCustomActivityStep } from "./save-custom-activity-step";

const writeMock = vi.fn().mockResolvedValue(null);

vi.mock("workflow", () => ({
  FatalError: class FatalError extends Error {},
  getWorkflowMetadata: vi.fn().mockReturnValue({ workflowRunId: "test-run-id" }),
  getWritable: vi.fn().mockReturnValue({
    getWriter: () => ({
      releaseLock: vi.fn(),
      write: writeMock,
    }),
  }),
  workflowStep: vi.fn().mockImplementation((_name: string, fn: unknown) => fn),
}));

describe(saveCustomActivityStep, () => {
  let organizationId: number;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId });

    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Save Custom Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("saves static content steps and marks activity as completed", async () => {
    const id = randomUUID().replaceAll("-", "").slice(0, 8);

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Custom Lesson ${randomUUID()}`,
    });

    const customActivity = await activityFixture({
      generationStatus: "pending",
      kind: "custom",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Custom ${randomUUID()}`,
    });

    const activityId = Number(customActivity.id);

    const contentSteps = [
      { text: `First step text ${id}`, title: `First title ${id}` },
      { text: `Second step text ${id}`, title: `Second title ${id}` },
    ];

    const visualRow = {
      activityId,
      content: assertStepContent("visual", {
        kind: "image",
        prompt: `A diagram showing ${id}`,
        url: `/images/${id}.png`,
      }),
      isPublished: true as const,
      kind: "visual" as const,
      position: 1,
    };

    await saveCustomActivityStep({
      activityId,
      completedRows: [visualRow],
      contentSteps,
      workflowRunId: "workflow-custom-1",
    });

    const [steps, dbActivity] = await Promise.all([
      prisma.step.findMany({
        orderBy: { position: "asc" },
        where: { activityId: customActivity.id },
      }),
      prisma.activity.findUniqueOrThrow({
        where: { id: customActivity.id },
      }),
    ]);

    // 2 static steps at positions 0, 2 + 1 visual step at position 1
    expect(steps).toHaveLength(3);

    expect(steps.map((step) => ({ kind: step.kind, position: step.position }))).toEqual([
      { kind: "static", position: 0 },
      { kind: "visual", position: 1 },
      { kind: "static", position: 2 },
    ]);

    expect(steps.every((step) => step.isPublished)).toBe(true);

    expect(dbActivity).toMatchObject({
      generationRunId: "workflow-custom-1",
      generationStatus: "completed",
    });

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "saveCustomActivity" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "saveCustomActivity" }),
    );
  });

  test("streams error when DB transaction fails", async () => {
    const invalidActivityId = 999_999_999;

    await saveCustomActivityStep({
      activityId: invalidActivityId,
      completedRows: [],
      contentSteps: [{ text: "Step text", title: "Step title" }],
      workflowRunId: "workflow-error",
    });

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "error", step: "saveCustomActivity" }),
    );
  });
});
