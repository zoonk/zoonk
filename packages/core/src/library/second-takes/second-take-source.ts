import "server-only";
import { DbNull, prisma } from "@zoonk/db";
import { libraryRowsVisibleTo } from "../_utils/library-visibility";
import { readLessonMap } from "../lessons/lesson-map";
import { CURRENT_STEPS } from "../lessons/lesson-versions";
import { isQuickLessonIdentityKey } from "../quick-lessons/quick-lesson-identity";
import { SECOND_TAKE_KEY_WHERE } from "./second-take-identity";

export async function findSecondTakeSource({
  language,
  ownerId,
  skillId,
}: {
  language: string;
  ownerId: string | null;
  skillId: string;
}) {
  const lessons = await prisma.lesson.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      canDo: true,
      description: true,
      homeChapter: { select: { homeCourse: { select: { country: true } } } },
      id: true,
      identityKey: true,
      level: true,
      summary: true,
      title: true,
    },
    where: {
      ...libraryRowsVisibleTo(ownerId),
      NOT: SECOND_TAKE_KEY_WHERE,
      contentStatus: "completed",
      language,
      setAsideAt: null,
      skills: { some: { skillId } },
      steps: { some: CURRENT_STEPS },
      summary: { not: DbNull },
    },
  });

  const mapped = lessons.flatMap(({ summary, ...lesson }) => {
    const map = readLessonMap(summary);
    return map ? [{ ...lesson, map }] : [];
  });

  return (
    mapped.find((lesson) => !isQuickLessonIdentityKey(lesson.identityKey)) ?? mapped[0] ?? null
  );
}
