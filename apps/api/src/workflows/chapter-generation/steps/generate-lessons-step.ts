import { generateLanguageChapterLessons } from "@zoonk/ai/tasks/chapters/language-lessons";
import { generateChapterLessons } from "@zoonk/ai/tasks/chapters/lessons";
import { safeAsync } from "@zoonk/utils/error";
import { streamError, streamStatus } from "../stream-status";
import { type ChapterContext } from "./get-chapter-step";

export type GeneratedLesson = {
  title: string;
  description: string;
};

function generateLessons(context: ChapterContext) {
  if (context.course.targetLanguage) {
    return generateLanguageChapterLessons({
      chapterDescription: context.description,
      chapterTitle: context.title,
      courseTitle: context.course.title,
      language: context.language,
      targetLanguage: context.course.targetLanguage,
    });
  }

  return generateChapterLessons({
    chapterDescription: context.description,
    chapterTitle: context.title,
    courseTitle: context.course.title,
    language: context.language,
  });
}

export async function generateLessonsStep(context: ChapterContext): Promise<GeneratedLesson[]> {
  "use step";

  await streamStatus({ status: "started", step: "generateLessons" });

  const { data: result, error } = await safeAsync(() => generateLessons(context));

  if (error) {
    await streamError({ reason: "aiGenerationFailed", step: "generateLessons" });
    throw error;
  }

  await streamStatus({ status: "completed", step: "generateLessons" });

  return result.data.lessons;
}
