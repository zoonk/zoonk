import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { generateLessonsStep } from "./generate-lessons-step";
import { type ChapterContext } from "./get-chapter-step";

const { generateChapterLessonsMock, generateLanguageChapterLessonsMock } = vi.hoisted(() => ({
  generateChapterLessonsMock: vi.fn(),
  generateLanguageChapterLessonsMock: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/chapters/lessons", () => ({
  generateChapterLessons: generateChapterLessonsMock,
}));

vi.mock("@zoonk/ai/tasks/chapters/language-lessons", () => ({
  generateLanguageChapterLessons: generateLanguageChapterLessonsMock,
}));

describe(generateLessonsStep, () => {
  let context: ChapterContext;
  let languageContext: ChapterContext;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();

    const [course, languageCourse] = await Promise.all([
      courseFixture({ organizationId: organization.id }),
      courseFixture({ format: "language", organizationId: organization.id, targetLanguage: "es" }),
    ]);

    const [chapter, languageChapter] = await Promise.all([
      chapterFixture({
        courseId: course.id,
        organizationId: organization.id,
        title: `Gen Lessons Chapter ${randomUUID()}`,
      }),
      chapterFixture({
        courseId: languageCourse.id,
        organizationId: organization.id,
        title: `Gen Lang Lessons Chapter ${randomUUID()}`,
      }),
    ]);

    context = { ...chapter, _count: { lessons: 0 }, course, neighboringChapters: [] };

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

  it("calls generateChapterLessons for non-language courses and returns lessons", async () => {
    const lessons = [
      { description: "Intro", title: "Lesson 1" },
      { description: "Basics", title: "Lesson 2" },
    ];

    generateChapterLessonsMock.mockResolvedValue({ data: { lessons } });
    const result = await generateLessonsStep(context);

    expect(result).toStrictEqual({ lessons, needsClassification: true });

    expect(generateChapterLessonsMock).toHaveBeenCalledWith({
      chapterDescription: context.description,
      chapterTitle: context.title,
      courseTitle: context.course.title,
      language: context.language,
      neighboringChapters: context.neighboringChapters,
    });

    const events = getStreamedEvents();

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "generateLessons" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "generateLessons" }),
    );

    expect(events).not.toContainEqual(expect.objectContaining({ step: "generateLessonKind" }));
  });

  it("calls generateLanguageChapterLessons for language courses", async () => {
    const lessons = [{ description: "Vocab", kind: "vocabulary" as const, title: "Words" }];

    generateLanguageChapterLessonsMock.mockResolvedValue({ data: { lessons } });

    const result = await generateLessonsStep(languageContext);

    expect(result).toStrictEqual({ lessons, needsClassification: false });

    expect(generateLanguageChapterLessonsMock).toHaveBeenCalledWith({
      chapterDescription: languageContext.description,
      chapterTitle: languageContext.title,
      targetLanguage: "es",
      userLanguage: languageContext.language,
    });

    const events = getStreamedEvents();

    expect(events).not.toContainEqual(expect.objectContaining({ step: "generateLessonKind" }));
  });

  it("uses format instead of a contradictory target language for non-language courses", async () => {
    const lessons = [{ description: "Basics", title: "Lesson 1" }];

    const contradictoryContext = {
      ...context,
      course: { ...context.course, targetLanguage: "es" },
    };

    generateChapterLessonsMock.mockResolvedValue({ data: { lessons } });

    const result = await generateLessonsStep(contradictoryContext);

    expect(result).toStrictEqual({ lessons, needsClassification: true });
    expect(generateChapterLessonsMock).toHaveBeenCalledOnce();
    expect(generateLanguageChapterLessonsMock).not.toHaveBeenCalled();
  });

  it("rejects a language course without its dependent target language", async () => {
    const invalidLanguageContext = {
      ...languageContext,
      course: { ...languageContext.course, targetLanguage: null },
    };

    await expect(generateLessonsStep(invalidLanguageContext)).rejects.toThrow(
      "Language course is missing a valid target language",
    );

    expect(generateChapterLessonsMock).not.toHaveBeenCalled();
    expect(generateLanguageChapterLessonsMock).not.toHaveBeenCalled();
  });

  it("throws without streaming error when AI generation fails", async () => {
    generateChapterLessonsMock.mockRejectedValue(new Error("AI failure"));

    await expect(generateLessonsStep(context)).rejects.toThrow("AI failure");

    const events = getStreamedEvents();

    expect(events).not.toContainEqual(
      expect.objectContaining({ status: "error", step: "generateLessons" }),
    );
  });
});
