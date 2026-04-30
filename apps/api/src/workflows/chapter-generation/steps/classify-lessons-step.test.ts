import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { classifyLessonsStep } from "./classify-lessons-step";
import { type ChapterContext } from "./get-chapter-step";

const { generateLessonKindMock } = vi.hoisted(() => ({ generateLessonKindMock: vi.fn() }));

vi.mock("@zoonk/ai/tasks/lessons/kind", () => ({ generateLessonKind: generateLessonKindMock }));

describe(classifyLessonsStep, () => {
  let context: ChapterContext;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    const course = await courseFixture({ organizationId: organization.id });
    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId: organization.id,
      title: `Classify Lessons Chapter ${randomUUID()}`,
    });

    context = { ...chapter, _count: { lessons: 0 }, course, neighboringChapters: [] };
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("classifies planned non-language lessons", async () => {
    const lessons = [
      { description: "Intro", title: "Lesson 1" },
      { description: "Basics", title: "Lesson 2" },
    ];

    generateLessonKindMock
      .mockResolvedValueOnce({ data: { kind: "explanation" as const } })
      .mockResolvedValueOnce({ data: { kind: "tutorial" as const } });

    const result = await classifyLessonsStep({
      context,
      plan: { lessons, needsClassification: true },
    });

    expect(result).toEqual([
      { description: "Intro", kind: "explanation", title: "Lesson 1" },
      { description: "Basics", kind: "tutorial", title: "Lesson 2" },
    ]);

    expect(generateLessonKindMock).toHaveBeenCalledTimes(2);
    expect(generateLessonKindMock).toHaveBeenNthCalledWith(1, {
      chapterTitle: context.title,
      courseTitle: context.course.title,
      language: context.language,
      lessonDescription: "Intro",
      lessonTitle: "Lesson 1",
    });
    expect(generateLessonKindMock).toHaveBeenNthCalledWith(2, {
      chapterTitle: context.title,
      courseTitle: context.course.title,
      language: context.language,
      lessonDescription: "Basics",
      lessonTitle: "Lesson 2",
    });

    const events = getStreamedEvents();

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "generateLessonKind" }),
    );
    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "generateLessonKind" }),
    );
  });

  test("returns language lessons without classification", async () => {
    const lessons = [{ description: "Vocab", kind: "vocabulary" as const, title: "Words" }];

    const result = await classifyLessonsStep({
      context,
      plan: { lessons, needsClassification: false },
    });

    expect(result).toEqual(lessons);
    expect(generateLessonKindMock).not.toHaveBeenCalled();
  });

  test("throws when lesson kind generation fails for any planned lesson", async () => {
    const lessons = [
      { description: "Intro", title: "Lesson 1" },
      { description: "Basics", title: "Lesson 2" },
    ];

    generateLessonKindMock
      .mockResolvedValueOnce({ data: { kind: "explanation" as const } })
      .mockRejectedValueOnce(new Error("Kind failure"));

    await expect(
      classifyLessonsStep({ context, plan: { lessons, needsClassification: true } }),
    ).rejects.toThrow("Kind failure");
  });
});
