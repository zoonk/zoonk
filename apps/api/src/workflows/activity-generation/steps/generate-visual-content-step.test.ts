import { randomUUID } from "node:crypto";
import { fetchLessonActivities } from "@/workflows/_test-utils/fetch-lesson-activities";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { generateVisualContentForActivityStep } from "./generate-visual-content-step";

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

const { dispatchVisualContentMock } = vi.hoisted(() => ({
  dispatchVisualContentMock: vi.fn(),
}));

vi.mock("@zoonk/core/steps/dispatch-visual-content", () => ({
  dispatchVisualContent: dispatchVisualContentMock,
}));

describe(generateVisualContentForActivityStep, () => {
  let organizationId: number;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId });

    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Gen Visual Content Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns visual rows positioned after their content steps", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Visual Content Positioned ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "explanation",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Explanation ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    const activity = activities[0]!;

    const descriptions = [
      { description: "A code snippet showing const x = 1", kind: "code" as const },
      { description: "An image of a concept", kind: "image" as const },
    ];

    dispatchVisualContentMock.mockResolvedValue([
      { annotations: null, code: "const x = 1;", kind: "code", language: "typescript" },
      { kind: "image", prompt: "An image of a concept", url: "https://example.com/image.webp" },
    ]);

    const result = await generateVisualContentForActivityStep(activity, descriptions);

    expect(result.completedRows).toHaveLength(2);

    expect(result.completedRows[0]).toMatchObject({
      activityId: activity.id,
      kind: "visual",
      position: 1,
    });

    expect(result.completedRows[1]).toMatchObject({
      activityId: activity.id,
      kind: "visual",
      position: 3,
    });
  });

  test("returns empty rows when descriptions are empty", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Visual Content Empty ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "explanation",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Explanation ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    const activity = activities[0]!;

    const result = await generateVisualContentForActivityStep(activity, []);

    expect(result).toEqual({ completedRows: [], hadFailure: false });
    expect(dispatchVisualContentMock).not.toHaveBeenCalled();
  });

  test("passes language and orgSlug to dispatcher", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Visual Content Language ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "explanation",
      language: "pt",
      lessonId: lesson.id,
      organizationId,
      title: `Explanation ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    const activity = activities[0]!;

    const descriptions = [{ description: "Um diagrama", kind: "diagram" as const }];

    dispatchVisualContentMock.mockResolvedValue([
      { edges: [], kind: "diagram", nodes: [{ id: "1", label: "Nó" }] },
    ]);

    await generateVisualContentForActivityStep(activity, descriptions);

    expect(dispatchVisualContentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        descriptions,
        language: "pt",
      }),
    );
  });

  test("streams started and completed events on success", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Visual Content Stream ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "explanation",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Explanation ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    const activity = activities[0]!;

    dispatchVisualContentMock.mockResolvedValue([
      { annotations: null, code: "x", kind: "code", language: "js" },
    ]);

    await generateVisualContentForActivityStep(activity, [
      { description: "A code snippet", kind: "code" as const },
    ]);

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({
        entityId: activity.id,
        status: "started",
        step: "generateVisualContent",
      }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({
        entityId: activity.id,
        status: "completed",
        step: "generateVisualContent",
      }),
    );
  });
});
