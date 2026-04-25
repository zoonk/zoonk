import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { fetchLessonActivities } from "@/workflows/activity-generation/steps/_utils/fetch-lesson-activities";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { generateCustomContentStep } from "./generate-custom-content-step";

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

const { generateActivityCustomMock } = vi.hoisted(() => ({
  generateActivityCustomMock: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/activities/custom", () => ({
  generateActivityCustom: generateActivityCustomMock,
}));

describe(generateCustomContentStep, () => {
  let organizationId: string;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId });

    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Gen Custom Content Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns custom content for one activity", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Custom Content ${randomUUID()}`,
    });

    await Promise.all([
      activityFixture({
        generationStatus: "pending",
        kind: "custom",
        language: "en",
        lessonId: lesson.id,
        organizationId,
        title: `Custom A ${randomUUID()}`,
      }),
      activityFixture({
        generationStatus: "pending",
        kind: "custom",
        language: "en",
        lessonId: lesson.id,
        organizationId,
        position: 1,
        title: `Custom B ${randomUUID()}`,
      }),
    ]);

    const activities = await fetchLessonActivities(lesson.id);

    generateActivityCustomMock.mockResolvedValue({
      data: {
        steps: [{ text: "Custom step text", title: "Custom step title" }],
      },
    });

    const result = await generateCustomContentStep(activities[0]!);

    expect(result.activityId).toBe(activities[0]?.id);
    expect(result.steps).toEqual([{ text: "Custom step text", title: "Custom step title" }]);
  });

  test("throws when AI returns empty content", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Custom Empty ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "custom",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Custom ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);

    generateActivityCustomMock.mockResolvedValue({
      data: { steps: [] },
    });

    await expect(generateCustomContentStep(activities[0]!)).rejects.toThrow(
      "Empty AI result for custom content",
    );
  });

  test("streams started and completed events", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Custom Stream ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "custom",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Custom ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);

    generateActivityCustomMock.mockResolvedValue({
      data: { steps: [{ text: "text", title: "title" }] },
    });

    await generateCustomContentStep(activities[0]!);

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "generateCustomContent" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "generateCustomContent" }),
    );
  });

  test("throws AI errors without streaming an error status", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Custom Error ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "custom",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Bad Custom ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);

    generateActivityCustomMock.mockRejectedValue(new Error("AI failure"));

    await expect(generateCustomContentStep(activities[0]!)).rejects.toThrow("AI failure");

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "generateCustomContent" }),
    );

    expect(events).not.toContainEqual(
      expect.objectContaining({ status: "error", step: "generateCustomContent" }),
    );
  });
});
