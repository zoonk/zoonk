import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { normalizeString, toSlug } from "@zoonk/utils/string";
import { streamStatus } from "../stream-status";
import { type CourseContext, type CreatedChapter, type GeneratedChapter } from "../types";

export async function addChaptersStep(input: {
  course: CourseContext;
  chapters: GeneratedChapter[];
}): Promise<CreatedChapter[]> {
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
      select: {
        description: true,
        id: true,
        position: true,
        slug: true,
        title: true,
      },
    }),
  );

  if (error || !createdChapters) {
    await streamStatus({ status: "error", step: "addChapters" });
    throw error ?? new Error("Failed to create chapters");
  }

  await streamStatus({ status: "completed", step: "addChapters" });

  return createdChapters;
}
