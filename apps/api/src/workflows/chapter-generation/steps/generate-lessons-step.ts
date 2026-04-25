import { createStepStream } from "@/workflows/_shared/stream-status";
import { generateLanguageChapterLessons } from "@zoonk/ai/tasks/chapters/language-lessons";
import { type ChapterLesson, generateChapterLessons } from "@zoonk/ai/tasks/chapters/lessons";
import { type ChapterStepName } from "@zoonk/core/workflows/steps";
import { safeAsync } from "@zoonk/utils/error";
import { type ChapterContext } from "./get-chapter-step";

function generateLessons(context: ChapterContext) {
  if (context.course.targetLanguage) {
    return generateLanguageChapterLessons({
      chapterDescription: context.description,
      chapterTitle: context.title,
      targetLanguage: context.course.targetLanguage,
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

export async function generateLessonsStep(context: ChapterContext): Promise<ChapterLesson[]> {
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
