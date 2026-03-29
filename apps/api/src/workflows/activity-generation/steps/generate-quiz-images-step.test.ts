import { randomUUID } from "node:crypto";
import { fetchLessonActivities } from "@/workflows/_test-utils/fetch-lesson-activities";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { generateQuizImagesStep } from "./generate-quiz-images-step";

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

const { generateStepImageMock } = vi.hoisted(() => ({
  generateStepImageMock: vi.fn(),
}));

vi.mock("@zoonk/core/steps/image", () => ({
  generateStepImage: generateStepImageMock,
}));

describe(generateQuizImagesStep, () => {
  let organizationId: number;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId });

    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Gen Quiz Images Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns questions unchanged when no selectImage questions exist", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Quiz Images No Select ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "quiz",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Quiz ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);

    const questions = [
      {
        context: "Some context",
        format: "multipleChoice" as const,
        options: [
          { feedback: "Correct!", isCorrect: true, text: "A" },
          { feedback: "Wrong", isCorrect: false, text: "B" },
        ],
        question: "What is correct?",
      },
    ];

    const result = await generateQuizImagesStep(activities, questions);

    expect(result).toEqual(questions);
    expect(generateStepImageMock).not.toHaveBeenCalled();
  });

  test("generates images for selectImage questions and injects URLs", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Quiz Images Select ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "quiz",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Quiz ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);

    const questions = [
      {
        format: "selectImage" as const,
        options: [
          { feedback: "Correct!", isCorrect: true, prompt: "a cat" },
          { feedback: "Wrong", isCorrect: false, prompt: "a dog" },
        ],
        question: "Which is a cat?",
      },
    ];

    generateStepImageMock
      .mockResolvedValueOnce({ data: "https://example.com/cat.png", error: null })
      .mockResolvedValueOnce({ data: "https://example.com/dog.png", error: null });

    const result = await generateQuizImagesStep(activities, questions);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      format: "selectImage",
      options: [
        expect.objectContaining({ prompt: "a cat", url: "https://example.com/cat.png" }),
        expect.objectContaining({ prompt: "a dog", url: "https://example.com/dog.png" }),
      ],
    });
  });

  test("returns empty array when no quiz activity exists", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Quiz Images None ${randomUUID()}`,
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

    const result = await generateQuizImagesStep(activities, [
      {
        format: "selectImage" as const,
        options: [{ feedback: "f", isCorrect: true, prompt: "p" }],
        question: "q",
      },
    ]);

    expect(result).toEqual([]);
  });

  test("returns empty array when questions list is empty", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Quiz Images Empty ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "quiz",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Quiz ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);

    const result = await generateQuizImagesStep(activities, []);

    expect(result).toEqual([]);
  });

  test("returns original options without URLs when image generation fails", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Quiz Images Fail ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "quiz",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Quiz ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);

    const questions = [
      {
        format: "selectImage" as const,
        options: [
          { feedback: "Correct!", isCorrect: true, prompt: "a cat" },
          { feedback: "Wrong", isCorrect: false, prompt: "a dog" },
        ],
        question: "Which is a cat?",
      },
    ];

    generateStepImageMock.mockRejectedValue(new Error("Image generation failed"));

    const result = await generateQuizImagesStep(activities, questions);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      format: "selectImage",
      options: [
        expect.objectContaining({ prompt: "a cat" }),
        expect.objectContaining({ prompt: "a dog" }),
      ],
    });

    // Options should not have URLs since generation failed
    const options = (result[0] as { options: { url?: string }[] }).options;
    expect(options[0]?.url).toBeUndefined();
    expect(options[1]?.url).toBeUndefined();
  });

  test("streams started and completed events", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Quiz Images Stream ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "quiz",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Quiz ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    const quizActivity = activities.find((a) => a.kind === "quiz")!;

    const questions = [
      {
        format: "selectImage" as const,
        options: [{ feedback: "f", isCorrect: true, prompt: "p" }],
        question: "q",
      },
    ];

    generateStepImageMock.mockResolvedValue({ data: "https://example.com/img.png", error: null });

    await generateQuizImagesStep(activities, questions);

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({
        entityId: quizActivity.id,
        status: "started",
        step: "generateQuizImages",
      }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({
        entityId: quizActivity.id,
        status: "completed",
        step: "generateQuizImages",
      }),
    );
  });
});
