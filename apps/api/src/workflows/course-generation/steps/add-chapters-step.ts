import { createChapters } from "@/data/chapters/create-chapters";
import { streamStatus } from "../stream-status";
import { type CourseContext, type CreatedChapter, type GeneratedChapter } from "../types";

export async function addChaptersStep(input: {
  course: CourseContext;
  chapters: GeneratedChapter[];
}): Promise<CreatedChapter[]> {
  "use step";

  await streamStatus({ status: "started", step: "addChapters" });

  const { data: createdChapters, error } = await createChapters({
    chapters: input.chapters,
    courseId: input.course.courseId,
    language: input.course.language,
    organizationId: input.course.organizationId,
  });

  if (error || !createdChapters) {
    await streamStatus({ status: "error", step: "addChapters" });
    throw error ?? new Error("Failed to create chapters");
  }

  await streamStatus({ status: "completed", step: "addChapters" });

  return createdChapters;
}
