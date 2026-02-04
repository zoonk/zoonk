import { generateChapterLessons } from "@zoonk/ai/tasks/chapters/lessons";
import { safeAsync } from "@zoonk/utils/error";
import { streamStatus } from "../stream-status";
import { type ChapterContext } from "./get-chapter-step";

export type GeneratedLesson = {
  title: string;
  description: string;
};

export async function generateLessonsStep(context: ChapterContext): Promise<GeneratedLesson[]> {
  "use step";

  await streamStatus({ status: "started", step: "generateLessons" });

  const { data: result, error } = await safeAsync(() =>
    generateChapterLessons({
      chapterDescription: context.description,
      chapterTitle: context.title,
      courseTitle: context.course.title,
      language: context.language,
    }),
  );

  if (error) {
    await streamStatus({ status: "error", step: "generateLessons" });
    throw error;
  }

  await streamStatus({ status: "completed", step: "generateLessons" });

  return result.data.lessons;
}
