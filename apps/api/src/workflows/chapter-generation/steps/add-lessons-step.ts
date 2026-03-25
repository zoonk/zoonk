import { createStepStream } from "@/workflows/_shared/stream-status";
import { type ChapterStepName } from "@/workflows/config";
import { type ChapterLesson } from "@zoonk/ai/tasks/chapters/lessons";
import { type Lesson, type LessonCreateManyInput, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { deduplicateSlugs, normalizeString, toSlug } from "@zoonk/utils/string";
import { type ChapterContext } from "./get-chapter-step";

export async function addLessonsStep(input: {
  context: ChapterContext;
  lessons: ChapterLesson[];
}): Promise<Lesson[]> {
  "use step";

  await using stream = createStepStream<ChapterStepName>();
  await stream.status({ status: "started", step: "addLessons" });

  const lessonsData: LessonCreateManyInput[] = deduplicateSlugs(
    input.lessons.map((lesson, index) => ({
      chapterId: input.context.id,
      concepts: lesson.concepts,
      description: lesson.description,
      generationStatus: "pending" as const,
      isPublished: true,
      language: input.context.language,
      normalizedTitle: normalizeString(lesson.title),
      organizationId: input.context.organizationId,
      position: index,
      slug: toSlug(lesson.title),
      title: lesson.title,
    })),
  );

  const { data: createdLessons, error } = await safeAsync(() =>
    prisma.lesson.createManyAndReturn({
      data: lessonsData,
    }),
  );

  if (error) {
    await stream.error({ reason: "dbSaveFailed", step: "addLessons" });
    throw error;
  }

  await stream.status({ status: "completed", step: "addLessons" });

  return createdLessons;
}
