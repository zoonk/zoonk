import { createStepStream } from "@/workflows/_shared/stream-status";
import {
  type LanguageChapterLesson,
  generateLanguageChapterLessons,
} from "@zoonk/ai/tasks/chapters/language-lessons";
import { type ChapterLesson, generateChapterLessons } from "@zoonk/ai/tasks/chapters/lessons";
import { type LessonKindSchema, generateLessonKind } from "@zoonk/ai/tasks/lessons/kind";
import { type ChapterStepName } from "@zoonk/core/workflows/steps";
import { safeAsync } from "@zoonk/utils/error";
import { getLanguageCourseTargetLanguage } from "./_utils/language-course";
import { type ChapterContext } from "./get-chapter-step";

type ClassifiedChapterLesson = ChapterLesson & { kind: LessonKindSchema["kind"] };

export type GeneratedChapterLesson = ClassifiedChapterLesson | LanguageChapterLesson;

/**
 * Lesson planning and lesson-kind classification are separate AI decisions so
 * the planner can focus on curriculum boundaries and the classifier can focus
 * on one lesson's learning approach. The calls run in parallel so every lesson
 * gets the same focused classification without adding serial latency.
 */
function classifyChapterLessons({
  context,
  lessons,
}: {
  context: ChapterContext;
  lessons: ChapterLesson[];
}): Promise<ClassifiedChapterLesson[]> {
  return Promise.all(lessons.map((lesson) => classifyChapterLesson({ context, lesson })));
}

/**
 * The lesson generation workflow depends on every planned non-language lesson
 * having one kind before it is saved, because downstream lesson generation uses
 * that kind to choose the correct content workflow.
 */
async function classifyChapterLesson({
  context,
  lesson,
}: {
  context: ChapterContext;
  lesson: ChapterLesson;
}): Promise<ClassifiedChapterLesson> {
  const result = await generateLessonKind({
    chapterTitle: context.title,
    courseTitle: context.course.title,
    language: context.language,
    lessonDescription: lesson.description,
    lessonTitle: lesson.title,
  });

  return {
    ...lesson,
    kind: result.data.kind,
  };
}

export async function generateLessonsStep(
  context: ChapterContext,
): Promise<GeneratedChapterLesson[]> {
  "use step";

  await using stream = createStepStream<ChapterStepName>();
  const targetLanguage = await getLanguageCourseTargetLanguage({ course: context.course });

  await stream.status({ status: "started", step: "generateLessons" });

  if (targetLanguage) {
    const { data: result, error } = await safeAsync(() =>
      generateLanguageChapterLessons({
        chapterDescription: context.description,
        chapterTitle: context.title,
        targetLanguage,
        userLanguage: context.language,
      }),
    );

    if (error) {
      throw error;
    }

    await stream.status({ status: "completed", step: "generateLessons" });
    await stream.status({ status: "completed", step: "generateLessonKind" });

    return result.data.lessons;
  }

  const { data: plannedLessons, error: planningError } = await safeAsync(() =>
    generateChapterLessons({
      chapterDescription: context.description,
      chapterTitle: context.title,
      courseTitle: context.course.title,
      language: context.language,
      neighboringChapters: context.neighboringChapters,
    }),
  );

  if (planningError) {
    throw planningError;
  }

  await stream.status({ status: "completed", step: "generateLessons" });
  await stream.status({ status: "started", step: "generateLessonKind" });

  const { data: classifiedLessons, error: kindError } = await safeAsync(() =>
    classifyChapterLessons({ context, lessons: plannedLessons.data.lessons }),
  );

  if (kindError) {
    throw kindError;
  }

  await stream.status({ status: "completed", step: "generateLessonKind" });

  return classifiedLessons;
}
