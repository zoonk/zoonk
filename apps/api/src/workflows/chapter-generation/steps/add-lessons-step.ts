import { createStepStream } from "@/workflows/_shared/stream-status";
import { type ChapterStepName } from "@zoonk/core/workflows/steps";
import { type Lesson, type LessonCreateManyInput, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { deduplicateSlugs, normalizeString, toSlug } from "@zoonk/utils/string";
import { getLanguageCourseTargetLanguage } from "./_utils/language-course";
import { expandChapterLessons } from "./_utils/lesson-plan-expansion";
import { type GeneratedChapterLesson } from "./generate-lessons-step";
import { type ChapterContext } from "./get-chapter-step";

export async function addLessonsStep(input: {
  context: ChapterContext;
  lessons: GeneratedChapterLesson[];
}): Promise<Lesson[]> {
  "use step";

  await using stream = createStepStream<ChapterStepName>();
  await stream.status({ status: "started", step: "addLessons" });

  const targetLanguage = await getLanguageCourseTargetLanguage({
    course: input.context.course,
  });

  const expandedLessons = expandChapterLessons({
    language: input.context.language,
    lessons: input.lessons,
    targetLanguage,
  });

  const lessonsData: LessonCreateManyInput[] = deduplicateSlugs(
    expandedLessons.map((lesson, index) => ({
      chapterId: input.context.id,
      description: lesson.description,
      generationStatus: lesson.kind === "review" ? ("completed" as const) : ("pending" as const),
      isPublished: true,
      kind: lesson.kind,
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
    throw error;
  }

  await stream.status({ status: "completed", step: "addLessons" });

  return createdLessons;
}
