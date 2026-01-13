import { cacheTagCourse } from "@zoonk/utils/cache";
import { revalidateTag } from "next/cache";
import { updateChapterGenerationStatus } from "@/data/chapters/update-chapter-generation-status";
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

  const { error: lessonsError } = await createLessons({
    chapterId: input.chapter.id,
    language: input.course.language,
    lessons: input.lessons,
    organizationId: input.course.organizationId,
  });

  if (lessonsError) {
    await streamStatus({ status: "error", step: "addLessons" });
    throw lessonsError;
  }

  // Mark the chapter as completed now that lessons are generated
  const { error: chapterError } = await updateChapterGenerationStatus({
    chapterId: input.chapter.id,
    generationRunId: input.generationRunId,
    generationStatus: "completed",
  });

  if (chapterError) {
    await streamStatus({ status: "error", step: "addLessons" });
    throw chapterError;
  }

  revalidateTag(cacheTagCourse({ courseSlug: input.course.courseSlug }), "max");

  await streamStatus({ status: "completed", step: "addLessons" });
}
