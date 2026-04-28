import { createStepStream } from "@/workflows/_shared/stream-status";
import {
  type LanguageChapterLesson,
  generateLanguageChapterLessons,
} from "@zoonk/ai/tasks/chapters/language-lessons";
import { type ChapterLesson, generateChapterLessons } from "@zoonk/ai/tasks/chapters/lessons";
import { type ChapterStepName } from "@zoonk/core/workflows/steps";
import { safeAsync } from "@zoonk/utils/error";
import { getLanguageCourseTargetLanguage } from "./_utils/language-course";
import { type ChapterContext } from "./get-chapter-step";

export type GeneratedChapterLesson = ChapterLesson | LanguageChapterLesson;

type GeneratedLessonsResponse = { data: { lessons: GeneratedChapterLesson[] } };

async function generateLessons(context: ChapterContext): Promise<GeneratedLessonsResponse> {
  const targetLanguage = await getLanguageCourseTargetLanguage({ course: context.course });

  if (targetLanguage) {
    return generateLanguageChapterLessons({
      chapterDescription: context.description,
      chapterTitle: context.title,
      targetLanguage,
      userLanguage: context.language,
    });
  }

  return generateChapterLessons({
    chapterDescription: context.description,
    chapterTitle: context.title,
    courseTitle: context.course.title,
    language: context.language,
    neighboringChapters: context.neighboringChapters,
  });
}

export async function generateLessonsStep(
  context: ChapterContext,
): Promise<GeneratedChapterLesson[]> {
  "use step";

  await using stream = createStepStream<ChapterStepName>();
  await stream.status({ status: "started", step: "generateLessons" });

  const { data: result, error } = await safeAsync(() => generateLessons(context));

  if (error) {
    throw error;
  }

  await stream.status({ status: "completed", step: "generateLessons" });

  return result.data.lessons;
}
