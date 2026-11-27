import "server-only";
import { prisma, sql } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getGoalsCacheTag, getSavedLessonsCacheTag, getUserProgressCacheTag } from "../cache/tags";
import { readSavedLessonIds } from "../learner/facts/saved-lessons";
import { getOwnedGoal } from "../learner/get-owned-goal";
import { startableLessonWhere } from "../lesson-player/_utils/lesson-rows";
import { loadSkillGroups } from "../view-models/syllabus/_utils/load-syllabus";
import { groupCompletedLessons } from "./_utils/completed-lesson-groups";
import { completedLessonRuns } from "./_utils/completed-lesson-runs";
import {
  type CompletedLesson,
  type CompletedLessonFilter,
  type CompletedLessonListInput,
} from "./contract";

export type CurrentUserCompletedLessons =
  | {
      filter: CompletedLessonFilter | null;
      hasMore: boolean;
      lessons: CompletedLesson[];
      status: "ready";
    }
  | { status: "notFound" }
  | { status: "unauthorized" };

/**
 * Newest first by the lesson's last finish; another learner's goal is notFound. A lesson's group is
 * the one of the skill the plan teaches it for, then of the skills the lesson itself teaches.
 */
export async function listCurrentUserCompletedLessons(
  input: CompletedLessonListInput,
): Promise<CurrentUserCompletedLessons> {
  "use cache: private";

  const owned = await getOwnedGoal(input.goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  cacheTag(
    getUserProgressCacheTag(owned.userId),
    getGoalsCacheTag(owned.userId),
    getSavedLessonsCacheTag(owned.userId),
  );

  const runs = completedLessonRuns({
    goalId: sql`${owned.goal.id}::uuid`,
    userId: sql`${owned.userId}::uuid`,
  });

  const [rows, groups, savedLessonIds] = await Promise.all([
    prisma.$queryRaw<
      (Omit<CompletedLesson, "available" | "group" | "saved"> & { skillIds: string[] })[]
    >`
      SELECT
        latest.lesson_id AS "lessonId",
        latest.title,
        chapter.title AS "chapterTitle",
        to_char(latest.local_date, 'YYYY-MM-DD') AS "finishedOn",
        ARRAY(
          SELECT taught.skill_id::text
          FROM (
            SELECT item.skill_id, 0 AS source, item.created_at
            FROM plan_items item JOIN plans plan ON plan.id = item.plan_id
            WHERE plan.goal_id = ${owned.goal.id}::uuid
              AND item.lesson_id = latest.lesson_id AND item.skill_id IS NOT NULL
            UNION ALL
            SELECT skill.skill_id, 1 AS source, skill.created_at
            FROM lesson_skills skill WHERE skill.lesson_id = latest.lesson_id
          ) taught
          ORDER BY taught.source, taught.created_at, taught.skill_id
        ) AS "skillIds"
      FROM (
        SELECT DISTINCT ON (run.lesson_id) run.*
        FROM (${runs}) run
        ORDER BY run.lesson_id, run.ended_at DESC
      ) latest
      LEFT JOIN library_chapters chapter ON chapter.id = latest.home_chapter_id
      ORDER BY latest.ended_at DESC, latest.lesson_id`,
    loadSkillGroups(owned.goal),
    readSavedLessonIds(owned.userId),
  ]);

  const { filter, keys } = groupCompletedLessons({
    goalKind: owned.goal.kind,
    groups,
    lessons: rows,
  });

  const lessons = rows.map(({ chapterTitle, finishedOn, lessonId, title }, index) => ({
    chapterTitle,
    finishedOn,
    group: keys[index] ?? null,
    lessonId,
    saved: savedLessonIds.has(lessonId),
    title,
  }));

  const wanted = filter?.groups.some((group) => group.key === input.group) ? input.group : null;
  const listed = wanted ? lessons.filter((lesson) => lesson.group === wanted) : lessons;
  const end = input.offset + input.limit;
  const page = listed.slice(input.offset, end);

  const startable =
    page.length === 0
      ? []
      : await prisma.lesson.findMany({
          select: { id: true },
          where: {
            ...startableLessonWhere(owned.userId),
            id: { in: page.map((row) => row.lessonId) },
          },
        });

  const available = new Set(startable.map((lesson) => lesson.id));

  return {
    filter,
    hasMore: listed.length > end,
    lessons: page.map((lesson) => ({ ...lesson, available: available.has(lesson.lessonId) })),
    status: "ready",
  };
}
