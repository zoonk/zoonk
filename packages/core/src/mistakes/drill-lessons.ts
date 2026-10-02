import "server-only";
import { prisma } from "@zoonk/db";
import { libraryRowsVisibleTo } from "../library/_utils/library-visibility";
import { toSummaryIdeas } from "../library/lessons/_utils/summary-ideas";
import { type MistakeDrill, type MistakeDrillKind } from "./mistake-drills";

/** The lesson a content-gap drill goes over first: its title and its summary card's ideas. */
type DrillLesson = { id: string; ideas: string[]; title: string };

/** A drill as apps show it: its kind, the lesson to go over before the questions, the time box. */
export type DrillView = {
  kind: MistakeDrillKind;
  lesson: DrillLesson | null;
  timeLimitSeconds: number | null;
};

/**
 * The first lesson teaching each skill that the learner can open (a public lesson or their own),
 * so a content-gap drill can bring the idea back before its questions.
 */
export async function findTeachingLessonIds({
  skillIds,
  userId,
}: {
  skillIds: readonly string[];
  userId: string;
}): Promise<Map<string, string>> {
  const rows = await prisma.lessonSkill.findMany({
    orderBy: { createdAt: "asc" },
    select: { lessonId: true, skillId: true },
    where: { lesson: libraryRowsVisibleTo(userId), skillId: { in: [...skillIds] } },
  });

  return new Map(
    rows
      .filter((row, index) => rows.findIndex((other) => other.skillId === row.skillId) === index)
      .map((row) => [row.skillId, row.lessonId]),
  );
}

/** The lessons drills go over first, with their summary ideas, by id. */
export async function loadDrillLessons(
  lessonIds: readonly (string | null)[],
): Promise<Map<string, DrillLesson>> {
  const ids = [...new Set(lessonIds.filter((id) => id !== null))];

  if (ids.length === 0) {
    return new Map();
  }

  const lessons = await prisma.lesson.findMany({
    select: { id: true, summary: true, title: true },
    where: { id: { in: ids } },
  });

  return new Map(
    lessons.map((lesson) => [
      lesson.id,
      { id: lesson.id, ideas: toSummaryIdeas(lesson.summary), title: lesson.title },
    ]),
  );
}

/** A drill as apps show it, its lesson resolved; a lesson that's gone leaves just the questions. */
export function toDrillView({
  drill,
  lessons,
}: {
  drill: Pick<MistakeDrill, "kind" | "lessonId" | "timeLimitSeconds">;
  lessons: ReadonlyMap<string, DrillLesson>;
}): DrillView {
  return {
    kind: drill.kind,
    lesson: drill.lessonId ? (lessons.get(drill.lessonId) ?? null) : null,
    timeLimitSeconds: drill.timeLimitSeconds,
  };
}
