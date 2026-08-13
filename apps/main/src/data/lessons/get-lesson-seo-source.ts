import "server-only";
import { getLessonSeoSourceKind } from "@/lib/lessons/seo";
import { type Lesson, getPublishedLessonWhere, prisma } from "@zoonk/db";

/** Authored SEO sources need both the expected kind and visible topic copy. */
function isLessonSeoSource({
  lesson,
  sourceKind,
}: {
  lesson: Lesson;
  sourceKind: Lesson["kind"];
}): boolean {
  return lesson.kind === sourceKind && Boolean(lesson.title);
}

/**
 * Finds the authored lesson that gives a generated companion its SEO topic.
 * One ordered snapshot locates the companion by stable ID before scanning
 * backward, so an earlier language split cannot make a stale position select
 * the wrong vocabulary topic.
 */
export async function getLessonSeoSource(
  lesson: Pick<Lesson, "chapterId" | "id" | "kind">,
): Promise<Lesson | null> {
  const sourceKind = getLessonSeoSourceKind(lesson.kind);

  if (!sourceKind) {
    return null;
  }

  const lessons = await prisma.lesson.findMany({
    orderBy: { position: "asc" },
    where: {
      OR: [
        { chapterId: lesson.chapterId, id: lesson.id },
        getPublishedLessonWhere({ chapterWhere: { id: lesson.chapterId } }),
      ],
    },
  });

  const lessonIndex = lessons.findIndex((candidate) => candidate.id === lesson.id);

  if (lessonIndex === -1) {
    return null;
  }

  return (
    lessons
      .slice(0, lessonIndex)
      .findLast((candidate) => isLessonSeoSource({ lesson: candidate, sourceKind })) ?? null
  );
}
