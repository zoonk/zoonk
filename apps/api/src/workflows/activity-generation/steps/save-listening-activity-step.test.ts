import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { fetchLessonActivities } from "@/workflows/activity-generation/steps/_utils/fetch-lesson-activities";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { saveListeningActivityStep } from "./save-listening-activity-step";

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

describe(saveListeningActivityStep, () => {
  let organizationId: string;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId, targetLanguage: "de" });

    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Save Listening Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("copies reading steps to listening activity and marks as completed", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Listening Copy ${randomUUID()}`,
    });

    const [readingActivity, listeningActivity] = await Promise.all([
      activityFixture({
        generationStatus: "completed",
        kind: "reading",
        language: "en",
        lessonId: lesson.id,
        organizationId,
        position: 0,
        title: `Reading ${randomUUID()}`,
      }),
      activityFixture({
        generationStatus: "pending",
        kind: "listening",
        language: "en",
        lessonId: lesson.id,
        organizationId,
        position: 1,
        title: `Listening ${randomUUID()}`,
      }),
    ]);

    const sentence1 = await prisma.sentence.create({
      data: {
        organizationId,
        sentence: `Sentence one ${randomUUID()}`,
        targetLanguage: "de",
      },
    });

    const sentence2 = await prisma.sentence.create({
      data: {
        organizationId,
        sentence: `Sentence two ${randomUUID()}`,
        targetLanguage: "de",
      },
    });

    await prisma.step.createMany({
      data: [
        {
          activityId: readingActivity.id,
          content: {},
          isPublished: true,
          kind: "reading",
          position: 0,
          sentenceId: sentence1.id,
        },
        {
          activityId: readingActivity.id,
          content: {},
          isPublished: true,
          kind: "reading",
          position: 1,
          sentenceId: sentence2.id,
        },
      ],
    });

    const activities = await fetchLessonActivities(lesson.id);

    await saveListeningActivityStep(activities, "workflow-listening-1");

    const [listeningSteps, dbActivity] = await Promise.all([
      prisma.step.findMany({
        orderBy: { position: "asc" },
        where: { activityId: listeningActivity.id },
      }),
      prisma.activity.findUniqueOrThrow({
        where: { id: listeningActivity.id },
      }),
    ]);

    expect(listeningSteps).toHaveLength(2);
    expect(listeningSteps.map((step) => step.kind)).toEqual(["listening", "listening"]);
    expect(listeningSteps.map((step) => step.position)).toEqual([0, 1]);
    expect(listeningSteps.map((step) => step.sentenceId)).toEqual([sentence1.id, sentence2.id]);
    expect(listeningSteps.every((step) => step.isPublished)).toBe(true);

    expect(dbActivity).toMatchObject({
      generationRunId: "workflow-listening-1",
      generationStatus: "completed",
    });

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "saveListeningActivity" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "saveListeningActivity" }),
    );
  });

  test("marks listening as failed when reading activity has no steps", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Listening No Steps ${randomUUID()}`,
    });

    await Promise.all([
      activityFixture({
        generationStatus: "completed",
        kind: "reading",
        language: "en",
        lessonId: lesson.id,
        organizationId,
        position: 0,
        title: `Reading ${randomUUID()}`,
      }),
      activityFixture({
        generationStatus: "pending",
        kind: "listening",
        language: "en",
        lessonId: lesson.id,
        organizationId,
        position: 1,
        title: `Listening ${randomUUID()}`,
      }),
    ]);

    const activities = await fetchLessonActivities(lesson.id);

    await saveListeningActivityStep(activities, "workflow-listening-2");

    const listeningActivity = activities.find((act) => act.kind === "listening")!;

    const [steps, dbActivity] = await Promise.all([
      prisma.step.findMany({
        where: { activityId: listeningActivity.id },
      }),
      prisma.activity.findUniqueOrThrow({
        where: { id: listeningActivity.id },
      }),
    ]);

    expect(steps).toHaveLength(0);
    expect(dbActivity.generationStatus).toBe("failed");

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "error", step: "saveListeningActivity" }),
    );
  });

  test("returns early when listening activity is already completed", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Listening Already Done ${randomUUID()}`,
    });

    const [readingActivity, listeningActivity] = await Promise.all([
      activityFixture({
        generationStatus: "completed",
        kind: "reading",
        language: "en",
        lessonId: lesson.id,
        organizationId,
        position: 0,
        title: `Reading ${randomUUID()}`,
      }),
      activityFixture({
        generationStatus: "completed",
        kind: "listening",
        language: "en",
        lessonId: lesson.id,
        organizationId,
        position: 1,
        title: `Listening ${randomUUID()}`,
      }),
    ]);

    await prisma.step.createMany({
      data: [
        {
          activityId: readingActivity.id,
          content: {},
          isPublished: true,
          kind: "reading",
          position: 0,
          sentenceId: null,
        },
      ],
    });

    const activities = await fetchLessonActivities(lesson.id);

    await saveListeningActivityStep(activities, "workflow-listening-3");

    const listeningSteps = await prisma.step.findMany({
      where: { activityId: listeningActivity.id },
    });

    expect(listeningSteps).toHaveLength(0);
  });
});
