import { createChapters } from "@/data/chapters/create-chapters";
import { streamStatus } from "../stream-status";
import type { CourseContext, CreatedChapter, GeneratedChapter } from "../types";

type AddInput = {
  course: CourseContext;
  chapters: GeneratedChapter[];
  generationRunId: string;
};

export async function addChaptersStep(
  input: AddInput,
): Promise<CreatedChapter[]> {
  "use step";

  await streamStatus({ status: "started", step: "addChapters" });

  const { data: createdChapters, error } = await createChapters({
    chapters: input.chapters,
    courseId: input.course.courseId,
    generationRunId: input.generationRunId,
    language: input.course.language,
  });

  if (error || !createdChapters) {
    await streamStatus({ status: "error", step: "addChapters" });
    throw error ?? new Error("Failed to create chapters");
  }

  await streamStatus({ status: "completed", step: "addChapters" });

  return createdChapters;
}
