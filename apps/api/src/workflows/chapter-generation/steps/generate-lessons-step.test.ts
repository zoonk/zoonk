import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseCategoryFixture, courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { generateLessonsStep } from "./generate-lessons-step";
import { type ChapterContext } from "./get-chapter-step";

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

const { generateChapterLessonsMock, generateLanguageChapterLessonsMock, generateLessonKindMock } =
  vi.hoisted(() => ({
    generateChapterLessonsMock: vi.fn(),
    generateLanguageChapterLessonsMock: vi.fn(),
    generateLessonKindMock: vi.fn(),
  }));

vi.mock("@zoonk/ai/tasks/chapters/lessons", () => ({
  generateChapterLessons: generateChapterLessonsMock,
}));

vi.mock("@zoonk/ai/tasks/chapters/language-lessons", () => ({
  generateLanguageChapterLessons: generateLanguageChapterLessonsMock,
}));

vi.mock("@zoonk/ai/tasks/lessons/kind", () => ({
  generateLessonKind: generateLessonKindMock,
}));

describe(generateLessonsStep, () => {
  let context: ChapterContext;
  let languageContext: ChapterContext;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    const course = await courseFixture({ organizationId: organization.id });
    const languageCourse = await courseFixture({
      organizationId: organization.id,
      targetLanguage: "es",
    });
    await courseCategoryFixture({ category: "languages", courseId: languageCourse.id });

    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId: organization.id,
      title: `Gen Lessons Chapter ${randomUUID()}`,
    });

    const languageChapter = await chapterFixture({
      courseId: languageCourse.id,
      organizationId: organization.id,
      title: `Gen Lang Lessons Chapter ${randomUUID()}`,
    });

    context = {
      ...chapter,
      _count: { lessons: 0 },
      course,
      neighboringChapters: [],
    };

    languageContext = {
      ...languageChapter,
      _count: { lessons: 0 },
      course: languageCourse,
      neighboringChapters: [],
    };
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("calls generateChapterLessons for non-language courses and returns lessons", async () => {
    const lessons = [
      { description: "Intro", title: "Lesson 1" },
      { description: "Basics", title: "Lesson 2" },
    ];

    generateChapterLessonsMock.mockResolvedValue({ data: { lessons } });
    generateLessonKindMock
      .mockResolvedValueOnce({ data: { kind: "explanation" as const } })
      .mockResolvedValueOnce({ data: { kind: "tutorial" as const } });

    const result = await generateLessonsStep(context);

    expect(result).toEqual([
      { description: "Intro", kind: "explanation", title: "Lesson 1" },
      { description: "Basics", kind: "tutorial", title: "Lesson 2" },
    ]);

    expect(generateChapterLessonsMock).toHaveBeenCalledWith({
      chapterDescription: context.description,
      chapterTitle: context.title,
      courseTitle: context.course.title,
      language: context.language,
      neighboringChapters: context.neighboringChapters,
    });

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

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "generateLessons" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "generateLessons" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "generateLessonKind" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "generateLessonKind" }),
    );
  });

  test("calls generateLanguageChapterLessons for language courses", async () => {
    const lessons = [{ description: "Vocab", kind: "vocabulary" as const, title: "Words" }];

    generateLanguageChapterLessonsMock.mockResolvedValue({ data: { lessons } });

    const result = await generateLessonsStep(languageContext);

    expect(result).toEqual(lessons);

    expect(generateLanguageChapterLessonsMock).toHaveBeenCalledWith({
      chapterDescription: languageContext.description,
      chapterTitle: languageContext.title,
      targetLanguage: "es",
      userLanguage: languageContext.language,
    });
    expect(generateLessonKindMock).not.toHaveBeenCalled();

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "generateLessonKind" }),
    );
  });

  test("uses the standard lesson generator when a course has no language category", async () => {
    const targetOnlyContext: ChapterContext = {
      ...context,
      course: { ...context.course, targetLanguage: "es" },
    };
    const lessons = [{ description: "Intro", title: "Lesson 1" }];

    generateChapterLessonsMock.mockResolvedValue({ data: { lessons } });
    generateLessonKindMock.mockResolvedValue({ data: { kind: "explanation" as const } });

    const result = await generateLessonsStep(targetOnlyContext);

    expect(result).toEqual([{ description: "Intro", kind: "explanation", title: "Lesson 1" }]);
    expect(generateChapterLessonsMock).toHaveBeenCalledOnce();
    expect(generateLessonKindMock).toHaveBeenCalledOnce();
    expect(generateLanguageChapterLessonsMock).not.toHaveBeenCalled();
  });

  test("throws when lesson kind generation fails for any planned lesson", async () => {
    const lessons = [
      { description: "Intro", title: "Lesson 1" },
      { description: "Basics", title: "Lesson 2" },
    ];

    generateChapterLessonsMock.mockResolvedValue({ data: { lessons } });
    generateLessonKindMock
      .mockResolvedValueOnce({ data: { kind: "explanation" as const } })
      .mockRejectedValueOnce(new Error("Kind failure"));

    await expect(generateLessonsStep(context)).rejects.toThrow("Kind failure");
  });

  test("throws without streaming error when AI generation fails", async () => {
    generateChapterLessonsMock.mockRejectedValue(new Error("AI failure"));

    await expect(generateLessonsStep(context)).rejects.toThrow("AI failure");

    const events = getStreamedEvents(writeMock);

    expect(events).not.toContainEqual(
      expect.objectContaining({ status: "error", step: "generateLessons" }),
    );
  });
});
