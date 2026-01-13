import { createLessons } from "@/data/lessons/create-lessons";
import { streamStatus } from "../stream-status";
import type { CourseContext, CreatedChapter, GeneratedLesson } from "../types";

type AddInput = {
  course: CourseContext;
  chapter: CreatedChapter;
  lessons: GeneratedLesson[];
  generationRunId: string;
};

export async function addLessonsStep(input: AddInput): Promise<void> {
  "use step";

  await streamStatus({ status: "started", step: "addLessons" });

  const { error } = await createLessons({
    chapterId: input.chapter.id,
    generationRunId: input.generationRunId,
    language: input.course.language,
    lessons: input.lessons,
  });

  if (error) {
    await streamStatus({ status: "error", step: "addLessons" });
    throw error;
  }

  await streamStatus({ status: "completed", step: "addLessons" });
}
