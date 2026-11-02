import "server-only";
import { type Lesson, prisma } from "@zoonk/db";
import { libraryRowsVisibleTo } from "../library/_utils/library-visibility";

export type MistakeLesson = { id: string; title: string };

type MistakeWithPlace = { id: string; skillId: string | null; step: { lessonId: string } | null };

function lessonPreference({
  finished,
  lesson,
}: {
  finished: ReadonlySet<string>;
  lesson: Pick<Lesson, "contentStatus" | "id">;
}): number {
  if (finished.has(lesson.id)) {
    return 0;
  }

  return lesson.contentStatus === "completed" ? 1 : 2;
}

async function findNotebookTeachingLessons({
  skillIds,
  userId,
}: {
  skillIds: readonly string[];
  userId: string;
}): Promise<Map<string, MistakeLesson>> {
  if (skillIds.length === 0) {
    return new Map();
  }

  const rows = await prisma.lessonSkill.findMany({
    include: { lesson: { select: { contentStatus: true, id: true, title: true } } },
    orderBy: { createdAt: "asc" },
    where: { lesson: libraryRowsVisibleTo(userId), skillId: { in: [...skillIds] } },
  });

  if (rows.length === 0) {
    return new Map();
  }

  const lessonIds = [...new Set(rows.map((row) => row.lessonId))];

  const completions = await prisma.$queryRaw<{ lessonId: string }[]>`
    SELECT DISTINCT content_ids->>'lessonId' AS "lessonId"
    FROM learning_events
    WHERE user_id = ${userId}::uuid
      AND kind IN ('lesson', 'review')
      AND ended_at IS NOT NULL
      AND content_ids->>'lessonId' = ANY(${lessonIds}::text[])`;

  const finished = new Set(completions.map((row) => row.lessonId));

  const preferred = rows.toSorted(
    (left, right) =>
      lessonPreference({ finished, lesson: left.lesson }) -
      lessonPreference({ finished, lesson: right.lesson }),
  );

  const bySkill = new Map<string, MistakeLesson>();

  for (const { lesson, skillId } of preferred) {
    if (!bySkill.has(skillId)) {
      bySkill.set(skillId, { id: lesson.id, title: lesson.title });
    }
  }

  return bySkill;
}

/** Only accessible lessons qualify; absent entries have no accessible teaching lesson. */
export async function findMistakeLessons({
  mistakes,
  userId,
}: {
  mistakes: readonly MistakeWithPlace[];
  userId: string;
}): Promise<Map<string, MistakeLesson>> {
  const skillIds = [
    ...new Set(mistakes.flatMap((mistake) => (mistake.skillId ? [mistake.skillId] : []))),
  ];

  const lessonIds = [
    ...new Set(mistakes.flatMap((mistake) => (mistake.step ? [mistake.step.lessonId] : []))),
  ];

  const [teaching, lessons] = await Promise.all([
    findNotebookTeachingLessons({ skillIds, userId }),
    prisma.lesson.findMany({
      select: { id: true, title: true },
      where: { ...libraryRowsVisibleTo(userId), id: { in: lessonIds } },
    }),
  ]);

  const byId = new Map(lessons.map((lesson) => [lesson.id, lesson]));

  return new Map(
    mistakes.flatMap((mistake) => {
      const lesson =
        (mistake.step && byId.get(mistake.step.lessonId)) ||
        (mistake.skillId && teaching.get(mistake.skillId));

      return lesson ? [[mistake.id, lesson] as const] : [];
    }),
  );
}
