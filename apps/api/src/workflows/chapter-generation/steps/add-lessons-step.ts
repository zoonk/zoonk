import { type ChapterLesson } from "@zoonk/ai/tasks/chapters/lessons";
import { type Lesson, type LessonCreateManyInput, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { normalizeString, toSlug } from "@zoonk/utils/string";
import { streamError, streamStatus } from "../stream-status";
import { type ChapterContext } from "./get-chapter-step";

export async function addLessonsStep(input: {
  context: ChapterContext;
  lessons: ChapterLesson[];
}): Promise<Lesson[]> {
  "use step";

  await streamStatus({ status: "started", step: "addLessons" });

  const lessonsData: LessonCreateManyInput[] = input.lessons.map((lesson, index) => ({
    chapterId: input.context.id,
    concepts: lesson.concepts,
    description: lesson.description,
    generationStatus: "pending",
    isPublished: true,
    language: input.context.language,
    normalizedTitle: normalizeString(lesson.title),
    organizationId: input.context.organizationId,
    position: index,
    slug: toSlug(lesson.title),
    title: lesson.title,
  }));

  const { data: createdLessons, error } = await safeAsync(() =>
    prisma.lesson.createManyAndReturn({
      data: lessonsData,
    }),
  );

  if (error) {
    await streamError({ reason: "dbSaveFailed", step: "addLessons" });
    throw error;
  }

  await streamStatus({ status: "completed", step: "addLessons" });

  return createdLessons;
}
