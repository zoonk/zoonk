import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { normalizeString, toSlug } from "@zoonk/utils/string";
import { streamStatus } from "../stream-status";
import { type GeneratedLesson } from "./generate-lessons-step";
import { type ChapterContext } from "./get-chapter-step";

export async function addLessonsStep(input: {
  context: ChapterContext;
  lessons: GeneratedLesson[];
}): Promise<void> {
  "use step";

  await streamStatus({ status: "started", step: "addLessons" });

  const lessonsData = input.lessons.map((lesson, index) => ({
    chapterId: input.context.id,
    description: lesson.description,
    generationStatus: "pending" as const,
    isPublished: true,
    language: input.context.language,
    normalizedTitle: normalizeString(lesson.title),
    organizationId: input.context.organizationId,
    position: index,
    slug: toSlug(lesson.title),
    title: lesson.title,
  }));

  const { error } = await safeAsync(() => prisma.lesson.createMany({ data: lessonsData }));

  if (error) {
    await streamStatus({ status: "error", step: "addLessons" });
    throw error;
  }

  await streamStatus({ status: "completed", step: "addLessons" });
}
