import "server-only";
import { prisma } from "@zoonk/db";
import { libraryRowsVisibleTo } from "../library/_utils/library-visibility";
import { toSummaryIdeas } from "../library/lessons/_utils/summary-ideas";
import { type DrillLesson, type DrillView, type MistakeDrill } from "./mistake-drills";

/** Returns only lessons visible to this learner. */
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

/** Missing teaching lessons leave a question-only drill. */
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
