import "server-only";
import { type Lesson, prisma } from "@zoonk/db";
import { libraryRowsVisibleTo } from "../library/_utils/library-visibility";
import { readMistakeReplay } from "./mistake-replay";

export type MistakeLesson = { id: string; title: string };

type MistakeWithPlace = {
  id: string;
  item?: { skillId: string } | null;
  skillId: string | null;
  snapshot: unknown;
  step: { lessonId: string } | null;
};

export function getMistakeLessonPlace({ id, item, skillId, snapshot, step }: MistakeWithPlace) {
  const replay = readMistakeReplay(snapshot);

  return {
    id,
    lessonId: step?.lessonId ?? (replay?.kind === "lesson" ? replay.lesson.lessonId : null),
    skillId:
      skillId ??
      item?.skillId ??
      (replay?.kind === "item" ? replay.item.skillId : replay?.lesson.step.skillId) ??
      null,
  };
}

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
    where: {
      lesson: { ...libraryRowsVisibleTo(userId), setAsideAt: null },
      skillId: { in: [...skillIds] },
    },
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
  places,
  userId,
}: {
  places: readonly ReturnType<typeof getMistakeLessonPlace>[];
  userId: string;
}): Promise<Map<string, MistakeLesson>> {
  const skillIds = [...new Set(places.flatMap((place) => place.skillId ?? []))];
  const lessonIds = [...new Set(places.flatMap((place) => place.lessonId ?? []))];

  const [teaching, lessons] = await Promise.all([
    findNotebookTeachingLessons({ skillIds, userId }),
    lessonIds.length > 0
      ? prisma.lesson.findMany({
          select: { id: true, title: true },
          where: { ...libraryRowsVisibleTo(userId), id: { in: lessonIds }, setAsideAt: null },
        })
      : [],
  ]);

  const byId = new Map(lessons.map((lesson) => [lesson.id, lesson]));

  return new Map(
    places.flatMap((mistake) => {
      const lesson =
        (mistake.lessonId && byId.get(mistake.lessonId)) ||
        (mistake.skillId && teaching.get(mistake.skillId));

      return lesson ? [[mistake.id, lesson] as const] : [];
    }),
  );
}
