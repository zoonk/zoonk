import { randomUUID } from "node:crypto";
import { fetchLessonActivities } from "@/workflows/_test-utils/fetch-lesson-activities";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { generateImagesForActivityStep } from "./generate-images-step";

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

const { generateVisualStepImageMock } = vi.hoisted(() => ({
  generateVisualStepImageMock: vi.fn(),
}));

vi.mock("@zoonk/core/steps/visual-image", () => ({
  generateVisualStepImage: generateVisualStepImageMock,
}));

describe(generateImagesForActivityStep, () => {
  let organizationId: number;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId });

    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Gen Images Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("generates images for visual rows with kind image and injects URLs", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Images Content ${randomUUID()}`,
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

    const visuals = [
      { kind: "image" as const, prompt: "a cat", stepIndex: 0 },
      {
        annotations: null,
        code: "const x = 1;",
        kind: "code" as const,
        language: "js",
        stepIndex: 1,
      },
    ];

    const visualRows = [
      {
        activityId: activity.id,
        content: { kind: "image" as const, prompt: "a cat" },
        isPublished: true as const,
        kind: "visual" as const,
        position: 1,
      },
      {
        activityId: activity.id,
        content: { annotations: null, code: "const x = 1;", kind: "code" as const, language: "js" },
        isPublished: true as const,
        kind: "visual" as const,
        position: 3,
      },
    ];

    generateVisualStepImageMock.mockResolvedValue({
      data: "https://example.com/cat.png",
      error: null,
    });

    const result = await generateImagesForActivityStep(activity, visuals, visualRows);

    expect(result.completedRows[0]?.content).toMatchObject({
      kind: "image",
      prompt: "a cat",
      url: "https://example.com/cat.png",
    });

    expect(result.completedRows[1]?.content).toMatchObject({
      kind: "code",
      language: "js",
    });

    expect(result.visuals).toContainEqual(
      expect.objectContaining({
        kind: "image",
        prompt: "a cat",
        url: "https://example.com/cat.png",
      }),
    );
  });

  test("returns rows unchanged when no image visuals exist", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Images No Image ${randomUUID()}`,
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

    const visuals = [
      {
        annotations: null,
        code: "const x = 1;",
        kind: "code" as const,
        language: "js",
        stepIndex: 0,
      },
    ];

    const visualRows = [
      {
        activityId: activity.id,
        content: { annotations: null, code: "const x = 1;", kind: "code" as const, language: "js" },
        isPublished: true as const,
        kind: "visual" as const,
        position: 1,
      },
    ];

    const result = await generateImagesForActivityStep(activity, visuals, visualRows);

    expect(result.completedRows).toEqual(visualRows);
    expect(generateVisualStepImageMock).not.toHaveBeenCalled();
  });

  test("returns empty visuals when inputs are empty", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Images Empty ${randomUUID()}`,
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

    const result = await generateImagesForActivityStep(activity, [], []);

    expect(result).toEqual({ completedRows: [], visuals: [] });
    expect(generateVisualStepImageMock).not.toHaveBeenCalled();
  });

  test("streams error when some image generations fail", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Images Error ${randomUUID()}`,
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

    const visuals = [
      { kind: "image" as const, prompt: "good", stepIndex: 0 },
      { kind: "image" as const, prompt: "bad", stepIndex: 1 },
    ];

    const visualRows = [
      {
        activityId: activity.id,
        content: { kind: "image" as const, prompt: "good" },
        isPublished: true as const,
        kind: "visual" as const,
        position: 1,
      },
      {
        activityId: activity.id,
        content: { kind: "image" as const, prompt: "bad" },
        isPublished: true as const,
        kind: "visual" as const,
        position: 3,
      },
    ];

    generateVisualStepImageMock
      .mockResolvedValueOnce({ data: "https://example.com/good.png", error: null })
      .mockRejectedValueOnce(new Error("Image generation failed"));

    await generateImagesForActivityStep(activity, visuals, visualRows);

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({
        entityId: activity.id,
        status: "error",
        step: "generateImages",
      }),
    );
  });

  test("streams started and completed events on success", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Images Stream ${randomUUID()}`,
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

    const visuals = [{ kind: "image" as const, prompt: "a cat", stepIndex: 0 }];

    const visualRows = [
      {
        activityId: activity.id,
        content: { kind: "image" as const, prompt: "a cat" },
        isPublished: true as const,
        kind: "visual" as const,
        position: 1,
      },
    ];

    generateVisualStepImageMock.mockResolvedValue({
      data: "https://example.com/cat.png",
      error: null,
    });

    await generateImagesForActivityStep(activity, visuals, visualRows);

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({
        entityId: activity.id,
        status: "started",
        step: "generateImages",
      }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({
        entityId: activity.id,
        status: "completed",
        step: "generateImages",
      }),
    );
  });
});
