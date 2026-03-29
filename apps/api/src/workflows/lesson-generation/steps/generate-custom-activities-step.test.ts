import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { generateCustomActivitiesStep } from "./generate-custom-activities-step";
import { type LessonContext } from "./get-lesson-step";

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

const { generateLessonActivitiesMock } = vi.hoisted(() => ({
  generateLessonActivitiesMock: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/lessons/activities", () => ({
  generateLessonActivities: generateLessonActivitiesMock,
}));

describe(generateCustomActivitiesStep, () => {
  let context: LessonContext;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    const course = await courseFixture({ organizationId: organization.id });

    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId: organization.id,
      title: `Custom Activities Chapter ${randomUUID()}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "custom",
      organizationId: organization.id,
      title: `Custom Activities Lesson ${randomUUID()}`,
    });

    context = {
      ...lesson,
      _count: { activities: 0 },
      chapter: { ...chapter, course },
    };
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns generated activities from AI", async () => {
    const activities = [
      { description: "Learn basics", title: "Basics" },
      { description: "Practice drills", title: "Practice" },
    ];

    generateLessonActivitiesMock.mockResolvedValue({ data: { activities } });

    const result = await generateCustomActivitiesStep(context);

    expect(result).toEqual(activities);

    expect(generateLessonActivitiesMock).toHaveBeenCalledWith({
      chapterTitle: context.chapter.title,
      courseTitle: context.chapter.course.title,
      language: context.language,
      lessonDescription: context.description,
      lessonTitle: context.title,
    });

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "generateCustomActivities" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "generateCustomActivities" }),
    );
  });

  test("throws and streams error when AI generation fails", async () => {
    generateLessonActivitiesMock.mockRejectedValue(new Error("AI failure"));

    await expect(generateCustomActivitiesStep(context)).rejects.toThrow("AI failure");

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "error", step: "generateCustomActivities" }),
    );
  });
});
