import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { fetchLessonActivities } from "@/workflows/activity-generation/steps/_utils/fetch-lesson-activities";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { generateCustomStepImagesStep } from "./generate-custom-step-images-step";

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

const { generateStepImagesMock } = vi.hoisted(() => ({
  generateStepImagesMock: vi.fn(),
}));

vi.mock("./_utils/generate-step-images", () => ({
  generateStepImages: generateStepImagesMock,
}));

describe(generateCustomStepImagesStep, () => {
  let organizationId: string;
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

  test("returns step images for each custom activity", async () => {
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

    generateStepImagesMock.mockResolvedValue([
      {
        prompt: "A lesson illustration for Step 1",
        url: "https://example.com/step-1.webp",
      },
    ]);

    const result = await generateCustomStepImagesStep(activity, {
      activityId: activity.id,
      prompts: ["A lesson illustration for Step 1"],
    });

    expect(result).toEqual({
      activityId: activity.id,
      images: [
        {
          prompt: "A lesson illustration for Step 1",
          url: "https://example.com/step-1.webp",
        },
      ],
    });
  });

  test("throws image generation errors", async () => {
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
    const activity = activities[0]!;

    generateStepImagesMock.mockRejectedValue(new Error("Image generation failed"));

    await expect(
      generateCustomStepImagesStep(activity, {
        activityId: activity.id,
        prompts: ["A lesson illustration"],
      }),
    ).rejects.toThrow("Image generation failed");
  });

  test("returns empty images for an activity with empty prompts", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Custom Images No Prompts ${randomUUID()}`,
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

    const result = await generateCustomStepImagesStep(activity, {
      activityId: activity.id,
      prompts: [],
    });

    expect(result).toEqual({ activityId: activity.id, images: [] });
    expect(generateStepImagesMock).not.toHaveBeenCalled();
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

    generateStepImagesMock.mockResolvedValue([
      {
        prompt: "A lesson illustration for title",
        url: "https://example.com/title.webp",
      },
    ]);

    await generateCustomStepImagesStep(activity, {
      activityId: activity.id,
      prompts: ["A lesson illustration for title"],
    });

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "generateStepImages" }),
    );
    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "generateStepImages" }),
    );
  });

  test("does not stream an error status when image generation throws", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Custom Images Error ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "custom",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Custom Fail ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    const activity = activities[0]!;

    generateStepImagesMock.mockRejectedValue(new Error("Image generation failed"));

    await expect(
      generateCustomStepImagesStep(activity, {
        activityId: activity.id,
        prompts: ["A lesson illustration"],
      }),
    ).rejects.toThrow("Image generation failed");

    const events = getStreamedEvents(writeMock);
    expect(events).not.toContainEqual(
      expect.objectContaining({ status: "error", step: "generateStepImages" }),
    );
  });
});
