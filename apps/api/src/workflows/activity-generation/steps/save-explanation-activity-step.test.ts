import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { saveExplanationActivityStep } from "./save-explanation-activity-step";

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

describe(saveExplanationActivityStep, () => {
  let organizationId: string;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId });

    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Save Explanation Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("saves the ordered explanation flow and marks activity as completed", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Save Explanation ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "explanation",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Explanation ${randomUUID()}`,
    });

    const stepsToSave = [
      { text: `Why does this happen? ${randomUUID()}`, title: "" },
      { text: `Each layer adds a different label. ${randomUUID()}`, title: "" },
      {
        text: `This is why Google Maps can update your route. ${randomUUID()}`,
        title: "This is why",
      },
    ];
    const images = [
      {
        prompt: "An image of a packet with labels added around it.",
        url: "https://example.com/packet.webp",
      },
      {
        prompt: "A second image showing each layer adding a label.",
        url: "https://example.com/labels.webp",
      },
      {
        prompt: "A route update illustration in Google Maps.",
        url: "https://example.com/maps.webp",
      },
    ];

    await saveExplanationActivityStep({
      activityId: activity.id,
      images,
      steps: stepsToSave,
      workflowRunId: "workflow-1",
    });

    const [steps, dbActivity] = await Promise.all([
      prisma.step.findMany({
        orderBy: { position: "asc" },
        where: { activityId: activity.id },
      }),
      prisma.activity.findUniqueOrThrow({
        where: { id: activity.id },
      }),
    ]);

    expect(steps).toHaveLength(3);

    expect(steps.map((step) => [step.position, step.kind])).toEqual([
      [0, "static"],
      [1, "static"],
      [2, "static"],
    ]);

    expect(steps[0]?.content).toEqual({
      image: images[0],
      text: stepsToSave[0]?.text,
      title: stepsToSave[0]?.title,
      variant: "text",
    });
    expect(steps[1]?.content).toEqual({
      image: images[1],
      text: stepsToSave[1]?.text,
      title: stepsToSave[1]?.title,
      variant: "text",
    });
    expect(steps[2]?.content).toEqual({
      image: images[2],
      text: stepsToSave[2]?.text,
      title: stepsToSave[2]?.title,
      variant: "text",
    });

    expect(dbActivity).toMatchObject({
      generationRunId: "workflow-1",
      generationStatus: "completed",
    });

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({
        status: "started",
        step: "saveExplanationActivity",
      }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({
        status: "completed",
        step: "saveExplanationActivity",
      }),
    );
  });

  test("throws DB errors without streaming an error status", async () => {
    const invalidActivityId = randomUUID();

    await expect(
      saveExplanationActivityStep({
        activityId: invalidActivityId,
        images: [{ prompt: "A step image", url: "https://example.com/image.webp" }],
        steps: [{ text: "some text", title: "Title" }],
        workflowRunId: "workflow-2",
      }),
    ).rejects.toThrow();

    const events = getStreamedEvents(writeMock);

    expect(events).not.toContainEqual(
      expect.objectContaining({
        status: "error",
        step: "saveExplanationActivity",
      }),
    );
  });
});
