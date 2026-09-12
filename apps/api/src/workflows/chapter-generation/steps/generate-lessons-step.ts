import {
  getChapterLearningContext,
  getCourseGenerationPolicy,
} from "@/workflows/_shared/course-generation-context";
import { createStepStream } from "@/workflows/_shared/stream-status";
import {
  type LanguageChapterLesson,
  generateLanguageChapterLessons,
} from "@zoonk/ai/tasks/chapters/language-lessons";
import { type ChapterLesson, generateChapterLessons } from "@zoonk/ai/tasks/chapters/lessons";
import { type ChapterStepName } from "@zoonk/core/workflows/steps";
import { type ChapterContext, getChapterGenerationTargetLanguage } from "./get-chapter-step";

export type ChapterLessonPlan =
  | { lessons: ChapterLesson[]; needsClassification: true }
  | { lessons: LanguageChapterLesson[]; needsClassification: false };

export async function generateLessonsStep(context: ChapterContext): Promise<ChapterLessonPlan> {
  "use step";

  await using stream = createStepStream<ChapterStepName>();
  const targetLanguage = getChapterGenerationTargetLanguage(context.course);

  await stream.status({ status: "started", step: "generateLessons" });

  if (targetLanguage) {
    const result = await generateLanguageChapterLessons({
      chapterDescription: context.description,
      chapterTitle: context.title,
      learningContext: getChapterLearningContext(context),
      targetLanguage,
      userLanguage: context.language,
      ...getCourseGenerationPolicy(context.course),
    });

    await stream.status({ status: "completed", step: "generateLessons" });

    return { lessons: result.data.lessons, needsClassification: false };
  }

  const result = await generateChapterLessons({
    chapterDescription: context.description,
    chapterTitle: context.title,
    courseTitle: context.course.title,
    language: context.language,
    learningContext: getChapterLearningContext(context),
    neighboringChapters: context.neighboringChapters,
    ...getCourseGenerationPolicy(context.course),
  });

  await stream.status({ status: "completed", step: "generateLessons" });

  return { lessons: result.data.lessons, needsClassification: true };
}
