import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { fetchLessonActivities } from "@/workflows/activity-generation/steps/_utils/fetch-lesson-activities";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { generateCustomImagePromptsStep } from "./generate-custom-image-prompts-step";

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

const { generateStepImagePromptsMock } = vi.hoisted(() => ({
  generateStepImagePromptsMock: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/steps/image-prompts", () => ({
  generateStepImagePrompts: generateStepImagePromptsMock,
}));

describe(generateCustomImagePromptsStep, () => {
  let organizationId: string;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId });

    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Gen Custom Prompts Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns image prompts for each custom activity", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Custom Prompts ${randomUUID()}`,
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

    const contentResults = [
      {
        activityId: activity.id,
        steps: [{ text: "Step 1 text", title: "Step 1" }],
      },
    ];

    generateStepImagePromptsMock.mockResolvedValue({
      data: { prompts: ["A lesson illustration for Step 1"] },
    });

    const results = await generateCustomImagePromptsStep(activities, contentResults);

    expect(results).toEqual([
      {
        activityId: activity.id,
        prompts: ["A lesson illustration for Step 1"],
      },
    ]);
  });

  test("returns empty array when content results are empty", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Custom Prompts Empty ${randomUUID()}`,
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

    const results = await generateCustomImagePromptsStep(activities, []);

    expect(results).toEqual([]);
  });

  test("returns empty prompts for an activity with empty content steps", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Custom Prompts No Steps ${randomUUID()}`,
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

    const results = await generateCustomImagePromptsStep(activities, [
      { activityId: activity.id, steps: [] },
    ]);

    expect(results).toEqual([{ activityId: activity.id, prompts: [] }]);
    expect(generateStepImagePromptsMock).not.toHaveBeenCalled();
  });

  test("streams started and completed events", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Custom Prompts Stream ${randomUUID()}`,
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

    generateStepImagePromptsMock.mockResolvedValue({
      data: { prompts: ["A lesson illustration for title"] },
    });

    await generateCustomImagePromptsStep(activities, [
      { activityId: activity.id, steps: [{ text: "text", title: "title" }] },
    ]);

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "generateImagePrompts" }),
    );
    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "generateImagePrompts" }),
    );
  });

  test("streams error status when some AI calls fail", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Custom Prompts Error ${randomUUID()}`,
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

    generateStepImagePromptsMock
      .mockResolvedValueOnce({
        data: { prompts: ["A lesson illustration"] },
      })
      .mockRejectedValueOnce(new Error("Prompt generation failed"));

    const contentResults = activities.map((activity) => ({
      activityId: activity.id,
      steps: [{ text: "text", title: "title" }],
    }));

    const results = await generateCustomImagePromptsStep(activities, contentResults);

    expect(results).toHaveLength(1);

    const events = getStreamedEvents(writeMock);
    expect(events).toContainEqual(
      expect.objectContaining({ status: "error", step: "generateImagePrompts" }),
    );
  });
});
