import { randomUUID } from "node:crypto";
import { fetchLessonActivities } from "@/workflows/_test-utils/fetch-lesson-activities";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { generateCustomImagesStep } from "./generate-custom-images-step";

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

describe(generateCustomImagesStep, () => {
  let organizationId: number;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId });

    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Gen Custom Images Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("generates images for custom activity visual rows and injects URLs", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Custom Images ${randomUUID()}`,
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
    const activity = activities[0]!;

    const visualResults = [
      {
        activityId: activity.id,
        visualRows: [
          {
            activityId: activity.id,
            content: { kind: "image" as const, prompt: "a cat" },
            isPublished: true as const,
            kind: "visual" as const,
            position: 1,
          },
          {
            activityId: activity.id,
            content: { annotations: null, code: "x", kind: "code" as const, language: "js" },
            isPublished: true as const,
            kind: "visual" as const,
            position: 3,
          },
        ],
        visuals: [
          { kind: "image" as const, prompt: "a cat", stepIndex: 0 },
          { annotations: null, code: "x", kind: "code" as const, language: "js", stepIndex: 1 },
        ],
      },
    ];

    generateVisualStepImageMock.mockResolvedValue({
      data: "https://example.com/cat.png",
      error: null,
    });

    const results = await generateCustomImagesStep(activities, visualResults);

    expect(results).toHaveLength(1);
    expect(results[0]?.activityId).toBe(activity.id);

    expect(results[0]?.completedRows[0]?.content).toMatchObject({
      kind: "image",
      prompt: "a cat",
      url: "https://example.com/cat.png",
    });

    expect(results[0]?.completedRows[1]?.content).toMatchObject({
      kind: "code",
      language: "js",
    });
  });

  test("returns empty array when visual results are empty", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Custom Images Empty ${randomUUID()}`,
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

    const results = await generateCustomImagesStep(activities, []);

    expect(results).toEqual([]);
  });

  test("returns rows unchanged when no image visuals exist", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Custom Images No Image ${randomUUID()}`,
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
    const activity = activities[0]!;

    const visualResults = [
      {
        activityId: activity.id,
        visualRows: [
          {
            activityId: activity.id,
            content: { annotations: null, code: "x", kind: "code" as const, language: "js" },
            isPublished: true as const,
            kind: "visual" as const,
            position: 1,
          },
        ],
        visuals: [
          { annotations: null, code: "x", kind: "code" as const, language: "js", stepIndex: 0 },
        ],
      },
    ];

    const results = await generateCustomImagesStep(activities, visualResults);

    expect(results).toHaveLength(1);
    expect(results[0]?.completedRows).toEqual(visualResults[0]?.visualRows);
    expect(generateVisualStepImageMock).not.toHaveBeenCalled();
  });

  test("streams started and completed events", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Custom Images Stream ${randomUUID()}`,
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
    const activity = activities[0]!;

    generateVisualStepImageMock.mockResolvedValue({
      data: "https://example.com/img.png",
      error: null,
    });

    const visualResults = [
      {
        activityId: activity.id,
        visualRows: [
          {
            activityId: activity.id,
            content: { kind: "image" as const, prompt: "prompt" },
            isPublished: true as const,
            kind: "visual" as const,
            position: 1,
          },
        ],
        visuals: [{ kind: "image" as const, prompt: "prompt", stepIndex: 0 }],
      },
    ];

    await generateCustomImagesStep(activities, visualResults);

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "generateImages" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "generateImages" }),
    );
  });

  test("completes with all results when inner image generation fails gracefully", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Custom Images Error ${randomUUID()}`,
    });

    await Promise.all([
      activityFixture({
        generationStatus: "pending",
        kind: "custom",
        language: "en",
        lessonId: lesson.id,
        organizationId,
        title: `Custom OK ${randomUUID()}`,
      }),
      activityFixture({
        generationStatus: "pending",
        kind: "custom",
        language: "en",
        lessonId: lesson.id,
        organizationId,
        position: 1,
        title: `Custom Fail ${randomUUID()}`,
      }),
    ]);

    const activities = await fetchLessonActivities(lesson.id);

    generateVisualStepImageMock
      .mockResolvedValueOnce({ data: "https://example.com/ok.png", error: null })
      .mockResolvedValueOnce({ data: null, error: new Error("Image generation failed") });

    const visualResults = activities.map((a) => ({
      activityId: a.id,
      visualRows: [
        {
          activityId: a.id,
          content: { kind: "image" as const, prompt: "prompt" },
          isPublished: true as const,
          kind: "visual" as const,
          position: 1,
        },
      ],
      visuals: [{ kind: "image" as const, prompt: "prompt", stepIndex: 0 }],
    }));

    const results = await generateCustomImagesStep(activities, visualResults);

    expect(results).toHaveLength(2);

    expect(results[0]?.completedRows[0]?.content).toMatchObject({
      kind: "image",
      url: "https://example.com/ok.png",
    });

    const failedContent = results[1]?.completedRows[0]?.content as Record<string, unknown>;
    expect(failedContent.url).toBeUndefined();

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "generateImages" }),
    );
  });
});
