import { createStepStream } from "@/workflows/_shared/stream-status";
import {
  type LanguageChapterLesson,
  generateLanguageChapterLessons,
} from "@zoonk/ai/tasks/chapters/language-lessons";
import { type ChapterLesson, generateChapterLessons } from "@zoonk/ai/tasks/chapters/lessons";
import { type ChapterStepName } from "@zoonk/core/workflows/steps";
import { type ChapterContext } from "./get-chapter-step";

export type ChapterLessonPlan =
  | { lessons: ChapterLesson[]; needsClassification: true }
  | { lessons: LanguageChapterLesson[]; needsClassification: false };

export async function generateLessonsStep(context: ChapterContext): Promise<ChapterLessonPlan> {
  "use step";

  await using stream = createStepStream<ChapterStepName>();
  const targetLanguage = context.course.targetLanguage;

  await stream.status({ status: "started", step: "generateLessons" });

  if (targetLanguage) {
    const result = await generateLanguageChapterLessons({
      chapterDescription: context.description,
      chapterTitle: context.title,
      targetLanguage,
      userLanguage: context.language,
    });

    await stream.status({ status: "completed", step: "generateLessons" });

    return { lessons: result.data.lessons, needsClassification: false };
  }

  const result = await generateChapterLessons({
    chapterDescription: context.description,
    chapterTitle: context.title,
    courseTitle: context.course.title,
    language: context.language,
    neighboringChapters: context.neighboringChapters,
  });

  await stream.status({ status: "completed", step: "generateLessons" });

  return { lessons: result.data.lessons, needsClassification: true };
}
