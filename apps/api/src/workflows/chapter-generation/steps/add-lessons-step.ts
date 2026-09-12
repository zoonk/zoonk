import { randomUUID } from "node:crypto";
import { getChapterRevisionContext } from "@/workflows/_shared/course-generation-context";
import { createStepStream } from "@/workflows/_shared/stream-status";
import { withCurrentCourseRevision } from "@zoonk/core/workflows/internal/course-curriculum";
import { type ChapterStepName } from "@zoonk/core/workflows/steps";
import { type Lesson, type LessonCreateManyInput } from "@zoonk/db";
import { deduplicateSlugs, normalizeString, toSlug } from "@zoonk/utils/string";
import { type ExpandedChapterLesson } from "./_utils/lesson-plan-expansion";
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
  lessons: ExpandedChapterLesson[];
}): Promise<Lesson[]> {
  "use step";

  await using stream = createStepStream<ChapterStepName>();
  await stream.status({ status: "started", step: "addLessons" });

  const lessonIds = input.lessons.map(() => randomUUID());

  const lessonsData: LessonCreateManyInput[] = deduplicateSlugs(
    input.lessons.map((lesson, index) => {
      const routeLabel = getRouteLabel({ index, kind: lesson.kind, title: lesson.title });

      return {
        chapterId: input.context.id,
        description: lesson.description,
        generationStatus: lesson.kind === "review" ? ("completed" as const) : ("pending" as const),
        id: lessonIds[index],
        isPublished: true,
        kind: lesson.kind,
        language: input.context.language,
        normalizedTitle: lesson.title ? normalizeString(lesson.title) : null,
        organizationId: input.context.organizationId,
        position: index,
        slug: toSlug(routeLabel),
        sourceLessonId:
          lesson.kind === "quiz" || lesson.kind === "practice"
            ? (lessonIds[
                input.lessons
                  .slice(0, index)
                  .findLastIndex((source) => source.kind === "explanation")
              ] ?? null)
            : null,
        title: lesson.title,
      };
    }),
  );

  const created = await withCurrentCourseRevision({
    context: getChapterRevisionContext(input.context),
    operation: async (transaction) => {
      const existing = await transaction.lesson.findMany({
        orderBy: { position: "asc" },
        where: { chapterId: input.context.id },
      });

      if (existing.length > 0) {
        return existing;
      }

      return transaction.lesson.createManyAndReturn({ data: lessonsData });
    },
  });

  await stream.status({ status: "completed", step: "addLessons" });

  return created.status === "applied" ? created.value : [];
}
