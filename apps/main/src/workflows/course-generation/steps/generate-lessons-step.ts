import { generateChapterLessons } from "@zoonk/ai/chapter-lessons/generate";
import { streamStatus } from "../stream-status";
import type { CourseContext, CreatedChapter, GeneratedLesson } from "../types";

type GenerateInput = {
  course: CourseContext;
  chapter: CreatedChapter;
};

export async function generateLessonsStep(
  input: GenerateInput,
): Promise<GeneratedLesson[]> {
  "use step";

  await streamStatus({ status: "started", step: "generateLessons" });

  const { data } = await generateChapterLessons({
    chapterDescription: input.chapter.description,
    chapterTitle: input.chapter.title,
    courseTitle: input.course.courseTitle,
    language: input.course.language,
  });

  await streamStatus({ status: "completed", step: "generateLessons" });

  return data.lessons;
}
