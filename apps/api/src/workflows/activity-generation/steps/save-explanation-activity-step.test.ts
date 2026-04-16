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

  test("saves static content steps and marks activity as completed", async () => {
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

    const contentSteps = [
      { text: `First step text ${randomUUID()}`, title: "Step 1" },
      { text: `Second step text ${randomUUID()}`, title: "Step 2" },
      { text: `Third step text ${randomUUID()}`, title: "Step 3" },
    ];

    await saveExplanationActivityStep({
      activityId: activity.id,
      completedRows: [],
      contentSteps,
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
      [2, "static"],
      [4, "static"],
    ]);

    expect(dbActivity).toMatchObject({
      generationRunId: "workflow-1",
      generationStatus: "completed",
    });

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "saveExplanationActivity" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "saveExplanationActivity" }),
    );
  });

  test("streams error when DB transaction fails", async () => {
    const invalidActivityId = randomUUID();

    await saveExplanationActivityStep({
      activityId: invalidActivityId,
      completedRows: [],
      contentSteps: [{ text: "some text", title: "Title" }],
      workflowRunId: "workflow-2",
    });

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "error", step: "saveExplanationActivity" }),
    );
  });
});
