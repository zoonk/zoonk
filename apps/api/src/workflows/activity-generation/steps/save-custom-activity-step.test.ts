import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
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
  let organizationId: string;
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

    const activityId = customActivity.id;

    const contentSteps = [
      { text: `First step text ${id}`, title: `First title ${id}` },
      { text: `Second step text ${id}`, title: `Second title ${id}` },
    ];

    const images = [
      { prompt: `A diagram showing ${id}`, url: `/images/${id}-1.png` },
      { prompt: `A close-up showing ${id}`, url: `/images/${id}-2.png` },
    ];

    await saveCustomActivityStep({
      activityId,
      contentSteps,
      images,
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

    expect(steps).toHaveLength(2);

    expect(steps.map((step) => ({ kind: step.kind, position: step.position }))).toEqual([
      { kind: "static", position: 0 },
      { kind: "static", position: 1 },
    ]);

    expect(steps.every((step) => step.isPublished)).toBe(true);
    expect(steps[0]?.content).toEqual({
      image: images[0],
      text: contentSteps[0]?.text,
      title: contentSteps[0]?.title,
      variant: "text",
    });
    expect(steps[1]?.content).toEqual({
      image: images[1],
      text: contentSteps[1]?.text,
      title: contentSteps[1]?.title,
      variant: "text",
    });

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

  test("throws DB errors without streaming an error status", async () => {
    const invalidActivityId = randomUUID();

    await expect(
      saveCustomActivityStep({
        activityId: invalidActivityId,
        contentSteps: [{ text: "Step text", title: "Step title" }],
        images: [{ prompt: "A step image", url: "https://example.com/image.webp" }],
        workflowRunId: "workflow-error",
      }),
    ).rejects.toThrow();

    const events = getStreamedEvents(writeMock);

    expect(events).not.toContainEqual(
      expect.objectContaining({ status: "error", step: "saveCustomActivity" }),
    );
  });
});
