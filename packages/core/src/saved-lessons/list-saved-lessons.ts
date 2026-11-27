import "server-only";
import { prisma, sql } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getGoalsCacheTag, getSavedLessonsCacheTag } from "../cache/tags";
import { getOwnedGoal } from "../learner/get-owned-goal";
import { startableLessonWhere } from "../lesson-player/_utils/lesson-rows";
import { savedLessonsForGoal } from "./_utils/saved-lessons-for-goal";
import { type SavedLesson } from "./contract";

export type CurrentUserSavedLessons =
  | { lessons: SavedLesson[]; status: "ready" }
  | { status: "notFound" }
  | { status: "unauthorized" };

export async function listCurrentUserSavedLessons({
  goalId,
}: {
  goalId: string;
}): Promise<CurrentUserSavedLessons> {
  "use cache: private";

  const owned = await getOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  const { goal, userId } = owned;
  cacheTag(getGoalsCacheTag(userId), getSavedLessonsCacheTag(userId));

  const rows = savedLessonsForGoal({ goalId: sql`${goal.id}::uuid`, userId: sql`${userId}::uuid` });

  const saved = await prisma.$queryRaw<Pick<SavedLesson, "lessonId" | "title">[]>`
    SELECT lesson_id AS "lessonId", title FROM (${rows}) saved
    ORDER BY created_at DESC, id DESC`;

  if (saved.length === 0) {
    return { lessons: [], status: "ready" };
  }

  const startable = await prisma.lesson.findMany({
    select: { homeChapter: { select: { title: true } }, id: true, title: true },
    where: { ...startableLessonWhere(userId), id: { in: saved.map((row) => row.lessonId) } },
  });

  const byId = new Map(startable.map((lesson) => [lesson.id, lesson]));

  return {
    lessons: saved.map((row) => {
      const lesson = byId.get(row.lessonId);

      return {
        available: Boolean(lesson),
        chapterTitle: lesson?.homeChapter?.title ?? null,
        lessonId: row.lessonId,
        title: lesson?.title ?? row.title,
      };
    }),
    status: "ready",
  };
}
