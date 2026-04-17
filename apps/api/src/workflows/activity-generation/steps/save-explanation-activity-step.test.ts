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

  test("saves the mixed explanation flow and marks activity as completed", async () => {
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

    const plan = [
      {
        kind: "static" as const,
        text: `Why does this happen? ${randomUUID()}`,
        title: "",
      },
      {
        description: {
          description: "An image of a packet with labels added around it.",
          kind: "image" as const,
        },
        kind: "visual" as const,
      },
      {
        kind: "static" as const,
        text: `Each layer adds a different label. ${randomUUID()}`,
        title: "",
      },
      {
        kind: "multipleChoice" as const,
        options: [
          { feedback: "Correct.", isCorrect: true, text: "The network label" },
          { feedback: "Nope.", isCorrect: false, text: "The app meaning" },
        ],
        question: "Which part does a router mainly read?",
      },
      {
        kind: "static" as const,
        text: `This is why Google Maps can update your route. ${randomUUID()}`,
        title: "This is why",
      },
    ];

    const visuals = [
      {
        kind: "image",
        prompt: "An image of a packet with labels added around it.",
        url: "https://example.com/packet.webp",
      },
    ];

    await saveExplanationActivityStep({
      activityId: activity.id,
      plan,
      visuals,
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

    expect(steps).toHaveLength(5);

    expect(steps.map((step) => [step.position, step.kind])).toEqual([
      [0, "static"],
      [1, "visual"],
      [2, "static"],
      [3, "multipleChoice"],
      [4, "static"],
    ]);

    expect(steps[1]?.content).toEqual({
      kind: "image",
      prompt: "An image of a packet with labels added around it.",
      url: "https://example.com/packet.webp",
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

  test("streams error when DB transaction fails", async () => {
    const invalidActivityId = randomUUID();

    await saveExplanationActivityStep({
      activityId: invalidActivityId,
      plan: [{ kind: "static", text: "some text", title: "Title" }],
      visuals: [],
      workflowRunId: "workflow-2",
    });

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({
        status: "error",
        step: "saveExplanationActivity",
      }),
    );
  });
});
