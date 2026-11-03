import "server-only";
import { prisma, sql } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getUserProgressCacheTag } from "../cache/tags";
import { getOwnedGoal } from "../learner/get-owned-goal";
import { completedLessonRuns } from "./_utils/completed-lesson-runs";
import { type CompletedLesson, type CompletedLessonListInput } from "./contract";

export type CurrentUserCompletedLessons =
  | { hasMore: boolean; lessons: CompletedLesson[]; status: "ready" }
  | { status: "notFound" }
  | { status: "unauthorized" };

/** Newest first by the lesson's last finish; another learner's goal is notFound. */
export async function listCurrentUserCompletedLessons(
  input: CompletedLessonListInput,
): Promise<CurrentUserCompletedLessons> {
  "use cache: private";

  const owned = await getOwnedGoal(input.goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  cacheTag(getUserProgressCacheTag(owned.userId));

  const runs = completedLessonRuns({
    goalId: sql`${owned.goal.id}::uuid`,
    userId: sql`${owned.userId}::uuid`,
  });

  const rows = await prisma.$queryRaw<CompletedLesson[]>`
    SELECT
      latest.lesson_id AS "lessonId",
      latest.title,
      chapter.title AS "chapterTitle",
      to_char(latest.local_date, 'YYYY-MM-DD') AS "finishedOn"
    FROM (
      SELECT DISTINCT ON (run.lesson_id) run.*
      FROM (${runs}) run
      ORDER BY run.lesson_id, run.ended_at DESC
    ) latest
    LEFT JOIN library_chapters chapter ON chapter.id = latest.home_chapter_id
    ORDER BY latest.ended_at DESC, latest.lesson_id
    LIMIT ${input.limit + 1} OFFSET ${input.offset}`;

  return {
    hasMore: rows.length > input.limit,
    lessons: rows.slice(0, input.limit),
    status: "ready",
  };
}
