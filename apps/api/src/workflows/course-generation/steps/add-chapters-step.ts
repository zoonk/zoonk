import { type CourseChapter } from "@zoonk/ai/tasks/courses/chapters";
import { type Chapter, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { normalizeString, toSlug } from "@zoonk/utils/string";
import { streamError, streamStatus } from "../stream-status";
import { type CourseContext } from "./initialize-course-step";

export async function addChaptersStep(input: {
  course: CourseContext;
  chapters: CourseChapter[];
}): Promise<Chapter[]> {
  "use step";

  await streamStatus({ status: "started", step: "addChapters" });

  const chaptersData = input.chapters.map((chapter, index) => ({
    courseId: input.course.courseId,
    description: chapter.description,
    generationStatus: "pending" as const,
    isPublished: true,
    language: input.course.language,
    normalizedTitle: normalizeString(chapter.title),
    organizationId: input.course.organizationId,
    position: index,
    slug: toSlug(chapter.title),
    title: chapter.title,
  }));

  const { data: createdChapters, error } = await safeAsync(() =>
    prisma.chapter.createManyAndReturn({
      data: chaptersData,
    }),
  );

  if (error || !createdChapters) {
    await streamError({ reason: "dbSaveFailed", step: "addChapters" });
    throw error ?? new Error("Failed to create chapters");
  }

  await streamStatus({ status: "completed", step: "addChapters" });

  return createdChapters;
}
