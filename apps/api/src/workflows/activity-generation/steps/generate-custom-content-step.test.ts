import { randomUUID } from "node:crypto";
import { fetchLessonActivities } from "@/workflows/_test-utils/fetch-lesson-activities";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
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
  let organizationId: number;
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

  test("returns custom content results for each activity", async () => {
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

    const results = await generateCustomContentStep(activities);

    expect(results).toHaveLength(2);
    expect(results[0]?.activityId).toBe(activities[0]?.id);
    expect(results[0]?.steps).toEqual([{ text: "Custom step text", title: "Custom step title" }]);
    expect(results[1]?.activityId).toBe(activities[1]?.id);
  });

  test("returns empty array when activities list is empty", async () => {
    const results = await generateCustomContentStep([]);
    expect(results).toEqual([]);
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

    await generateCustomContentStep(activities);

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "generateCustomContent" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "generateCustomContent" }),
    );
  });

  test("streams error status when some AI calls fail", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Custom Error ${randomUUID()}`,
    });

    await Promise.all([
      activityFixture({
        generationStatus: "pending",
        kind: "custom",
        language: "en",
        lessonId: lesson.id,
        organizationId,
        title: `Good Custom ${randomUUID()}`,
      }),
      activityFixture({
        generationStatus: "pending",
        kind: "custom",
        language: "en",
        lessonId: lesson.id,
        organizationId,
        position: 1,
        title: `Bad Custom ${randomUUID()}`,
      }),
    ]);

    const activities = await fetchLessonActivities(lesson.id);

    generateActivityCustomMock
      .mockResolvedValueOnce({
        data: { steps: [{ text: "ok", title: "ok" }] },
      })
      .mockRejectedValueOnce(new Error("AI failure"));

    const results = await generateCustomContentStep(activities);

    expect(results).toHaveLength(1);
    expect(results[0]?.activityId).toBe(activities[0]?.id);

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "generateCustomContent" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "error", step: "generateCustomContent" }),
    );
  });
});
