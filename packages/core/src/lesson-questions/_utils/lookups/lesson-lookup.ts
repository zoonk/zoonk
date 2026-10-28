import "server-only";
import { type GoalTutorLookUpResult } from "@zoonk/ai/tasks/v2/tutor/goal-tutor-lookup";
import { type Goal, prisma } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";
import { listFinishedLessonIds } from "../../../catalog/_utils/finished-lessons";
import { toSummaryIdeas } from "../../../library/lessons/_utils/summary-ideas";
import { toIsoDate } from "../../../plans/planner/plan-calendar";
import { matchesQuery } from "./lookup-text";

const MAX_LESSONS = 3;

/** An exact title match returns alone; summary ideas never expose question answers. */
export async function lookUpLesson({
  goal,
  query,
}: {
  goal: Goal;
  query: string | null;
}): Promise<GoalTutorLookUpResult> {
  const what = "lesson";

  if (!query) {
    return { status: "notFound", what };
  }

  const [items, finished] = await Promise.all([
    prisma.planItem.findMany({
      orderBy: { position: "asc" },
      select: {
        lesson: { select: { canDo: true, description: true, summary: true, title: true } },
        lessonId: true,
        scheduledFor: true,
        status: true,
      },
      where: { kind: "lesson", lessonId: { not: null }, plan: { goalId: goal.id } },
    }),
    listFinishedLessonIds(goal.userId),
  ]);

  const wanted = normalizeString(query);

  const found = items
    .flatMap((item) =>
      item.lesson && item.lessonId && matchesQuery({ query, text: item.lesson.title })
        ? [{ ...item, lesson: item.lesson, lessonId: item.lessonId }]
        : [],
    )
    .filter(
      (item, index, all) => all.findIndex((other) => other.lessonId === item.lessonId) === index,
    );

  const exact = found.filter((item) => normalizeString(item.lesson.title) === wanted);
  const matches = (exact.length > 0 ? exact : found).slice(0, MAX_LESSONS);

  if (matches.length === 0) {
    return { status: "notFound", what };
  }

  return {
    lessons: matches.map((item) => {
      const done =
        item.status === "done" || item.status === "testedOut" || finished.has(item.lessonId);

      return {
        canDo: item.lesson.canDo,
        date: !done && item.scheduledFor ? toIsoDate(item.scheduledFor) : null,
        description: item.lesson.description,
        done,
        ideas: toSummaryIdeas(item.lesson.summary),
        title: item.lesson.title,
      };
    }),
    status: "found",
    what,
  };
}
