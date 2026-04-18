import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { generateCoreActivitiesStep } from "./generate-core-activities-step";
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

const { generateLessonCoreActivitiesMock } = vi.hoisted(() => ({
  generateLessonCoreActivitiesMock: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/lessons/core-activities", () => ({
  generateLessonCoreActivities: generateLessonCoreActivitiesMock,
}));

describe(generateCoreActivitiesStep, () => {
  let context: LessonContext;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    const course = await courseFixture({ organizationId: organization.id });

    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId: organization.id,
      title: `Core Activities Chapter ${randomUUID()}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Concept A", "Concept B"],
      kind: "core",
      organizationId: organization.id,
      title: `Core Activities Lesson ${randomUUID()}`,
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

  test("returns generated explanation activity titles from AI", async () => {
    const activities = [
      {
        goal: "spot the repeated pattern before turning it into a reusable rule",
        title: "Reading the pattern",
      },
      {
        goal: "turn the pattern into a rule you can apply to new cases",
        title: "Turning it into a rule",
      },
    ];

    generateLessonCoreActivitiesMock.mockResolvedValue({ data: { activities } });

    const result = await generateCoreActivitiesStep(context);

    expect(result).toEqual(activities);
    expect(generateLessonCoreActivitiesMock).toHaveBeenCalledWith({
      chapterTitle: context.chapter.title,
      concepts: context.concepts,
      courseTitle: context.chapter.course.title,
      language: context.language,
      lessonDescription: context.description,
      lessonTitle: context.title,
    });

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "generateCoreActivities" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "generateCoreActivities" }),
    );
  });

  test("throws and streams error when AI generation fails", async () => {
    generateLessonCoreActivitiesMock.mockRejectedValue(new Error("AI failure"));

    await expect(generateCoreActivitiesStep(context)).rejects.toThrow("AI failure");

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "error", step: "generateCoreActivities" }),
    );
  });
});
