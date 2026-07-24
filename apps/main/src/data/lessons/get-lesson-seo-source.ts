import "server-only";
import { getLessonSeoSourceKind } from "@/lib/lessons/seo";
import { type Lesson, getPublishedLessonWhere, prisma } from "@zoonk/db";

/**
 * Finds the authored lesson that gives a generated companion its SEO topic.
 * Chapter generation stores companions immediately after their source group,
 * so the nearest earlier lesson of the owning kind is the exact source for
 * quiz, practice, and translation metadata.
 */
export async function getLessonSeoSource(
  lesson: Pick<Lesson, "chapterId" | "kind" | "position">,
): Promise<Lesson | null> {
  const sourceKind = getLessonSeoSourceKind(lesson.kind);

  if (!sourceKind) {
    return null;
  }

  return prisma.lesson.findFirst({
    orderBy: { position: "desc" },
    where: getPublishedLessonWhere({
      chapterWhere: { id: lesson.chapterId },
      lessonWhere: { kind: sourceKind, position: { lt: lesson.position }, title: { not: "" } },
    }),
  });
}
