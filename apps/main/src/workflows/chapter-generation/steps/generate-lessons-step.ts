import { generateChapterLessons } from "@zoonk/ai/tasks/chapters/lessons";
import { streamStatus } from "../stream-status";
import { type ChapterContext } from "./get-chapter-step";

export type GeneratedLesson = {
  title: string;
  description: string;
};

export async function generateLessonsStep(context: ChapterContext): Promise<GeneratedLesson[]> {
  "use step";

  await streamStatus({ status: "started", step: "generateLessons" });

  try {
    const { data } = await generateChapterLessons({
      chapterDescription: context.description,
      chapterTitle: context.title,
      courseTitle: context.course.title,
      language: context.language,
    });

    await streamStatus({ status: "completed", step: "generateLessons" });

    return data.lessons;
  } catch (error) {
    await streamStatus({ status: "error", step: "generateLessons" });
    throw error;
  }
}
