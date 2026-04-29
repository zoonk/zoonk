import { createStepStream } from "@/workflows/_shared/stream-status";
import { type ChapterStepName } from "@zoonk/core/workflows/steps";
import { type Lesson, type LessonCreateManyInput, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { deduplicateSlugs, normalizeString, toSlug } from "@zoonk/utils/string";
import { expandChapterLessons } from "./_utils/lesson-plan-expansion";
import { type GeneratedChapterLesson } from "./classify-lessons-step";
import { type ChapterContext } from "./get-chapter-step";

/**
 * Lessons without authored titles still need stable URL slugs. The label is
 * only used for route generation, while the public UI can render current
 * kind-based copy from translations instead of storing generated fallback text.
 */
function getRouteLabel({
  index,
  kind,
  title,
}: {
  index: number;
  kind: string;
  title: string | null;
}): string {
  return title ?? `${kind}-${index + 1}`;
}

export async function addLessonsStep(input: {
  context: ChapterContext;
  lessons: GeneratedChapterLesson[];
}): Promise<Lesson[]> {
  "use step";

  await using stream = createStepStream<ChapterStepName>();
  await stream.status({ status: "started", step: "addLessons" });

  const expandedLessons = expandChapterLessons({
    lessons: input.lessons,
    targetLanguage: input.context.course.targetLanguage,
  });

  const lessonsData: LessonCreateManyInput[] = deduplicateSlugs(
    expandedLessons.map((lesson, index) => {
      const routeLabel = getRouteLabel({
        index,
        kind: lesson.kind,
        title: lesson.title,
      });

      return {
        chapterId: input.context.id,
        description: lesson.description,
        generationStatus: lesson.kind === "review" ? ("completed" as const) : ("pending" as const),
        isPublished: true,
        kind: lesson.kind,
        language: input.context.language,
        normalizedTitle: lesson.title ? normalizeString(lesson.title) : null,
        organizationId: input.context.organizationId,
        position: index,
        slug: toSlug(routeLabel),
        title: lesson.title,
      };
    }),
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
