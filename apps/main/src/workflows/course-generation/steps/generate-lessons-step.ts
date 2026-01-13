import { generateChapterLessons } from "@zoonk/ai/chapter-lessons/generate";
import { updateChapterGenerationStatus } from "@/data/chapters/update-chapter-generation-status";
import { streamStatus } from "../stream-status";
import type { CourseContext, CreatedChapter, GeneratedLesson } from "../types";

type GenerateInput = {
  course: CourseContext;
  chapter: CreatedChapter;
  generationRunId: string;
};

export async function generateLessonsStep(
  input: GenerateInput,
): Promise<GeneratedLesson[]> {
  "use step";

  await streamStatus({ status: "started", step: "generateLessons" });

  // Mark chapter as running
  await updateChapterGenerationStatus({
    chapterId: input.chapter.id,
    generationRunId: input.generationRunId,
    generationStatus: "running",
  });

  const { data } = await generateChapterLessons({
    chapterDescription: input.chapter.description,
    chapterTitle: input.chapter.title,
    courseTitle: input.course.courseTitle,
    language: input.course.language,
  });

  await streamStatus({ status: "completed", step: "generateLessons" });

  return data.lessons;
}
