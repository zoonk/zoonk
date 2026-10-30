import "server-only";
import { type Lesson, prisma } from "@zoonk/db";
import { getItemKey } from "../../plans/planner/plan-items";
import { DEFAULT_LESSON_MINUTES } from "../../plans/planner/plan-units";
import { type PlannedLesson } from "../session-builder";
import { getLessonLookahead } from "./day-lessons";
import { type SelectedDayPlan } from "./selected-day-plan";
import { type SessionPlanItem } from "./session-plan-item";

type LessonWithSkills = Lesson & { skills: { skillId: string }[] };

type LearnItem = Pick<
  SessionPlanItem,
  "chapterId" | "id" | "kind" | "lessonId" | "phase" | "scheduledFor" | "skillId"
>;

const LESSON_INCLUDE = {
  skills: { orderBy: { createdAt: "asc" }, select: { skillId: true } },
} as const;

function toPlannedLesson({
  item,
  lesson,
}: {
  item: LearnItem | null;
  lesson: LessonWithSkills;
}): PlannedLesson {
  return {
    canDo: lesson.canDo,
    chapterId: item?.chapterId ?? lesson.homeChapterId,
    lessonId: lesson.id,
    minutes: lesson.estimatedMinutes || DEFAULT_LESSON_MINUTES,
    planItemId: item?.id ?? null,
    planItemKey: item ? getItemKey(item) : null,
    planSkillId: item?.skillId ?? null,
    skillIds: lesson.skills.map((skill) => skill.skillId),
    title: lesson.title,
  };
}

/** Deleted, set-aside, and unoutlined lessons are omitted. */
export async function loadPlanLessons({
  items,
}: {
  items: readonly LearnItem[];
}): Promise<PlannedLesson[]> {
  const lessons = await prisma.lesson.findMany({
    include: LESSON_INCLUDE,
    where: { id: { in: items.flatMap((item) => item.lessonId ?? []) }, setAsideAt: null },
  });

  return items.flatMap((item) => {
    const lesson = lessons.find((candidate) => candidate.id === item.lessonId);
    return lesson ? [toPlannedLesson({ item, lesson })] : [];
  });
}

/** At most one lesson per skill, preserving supplied skill order. */
export async function loadLessonsForSkills({
  limit,
  skillIds,
}: {
  limit: number;
  skillIds: readonly string[];
}): Promise<PlannedLesson[]> {
  const rows = await prisma.lessonSkill.findMany({
    include: { lesson: { include: LESSON_INCLUDE } },
    orderBy: [{ createdAt: "asc" }, { lessonId: "asc" }],
    where: { lesson: { setAsideAt: null }, skillId: { in: [...skillIds] } },
  });

  const bySkill = skillIds.flatMap((skillId) => {
    const row = rows.find((candidate) => candidate.skillId === skillId);
    return row ? [row.lesson] : [];
  });

  const unique = bySkill.filter(
    (lesson, index) => bySkill.findIndex((other) => other.id === lesson.id) === index,
  );

  return unique.slice(0, limit).map((lesson) => toPlannedLesson({ item: null, lesson }));
}

/**
 * Look ahead after keptLessonIds so retained work cannot consume the window for newly landed
 * lessons. A day the plan selected loads them all: the selection already chose exactly its lessons.
 */
export function loadUpcomingLessons({
  dayMinutes,
  items,
  keptLessonIds,
  selection,
}: Parameters<typeof loadPlanLessons>[0] & {
  dayMinutes: number;
  keptLessonIds?: ReadonlySet<string>;
  selection?: SelectedDayPlan;
}) {
  const upcoming = items.filter((item) => !item.lessonId || !keptLessonIds?.has(item.lessonId));

  return loadPlanLessons({
    items: selection ? upcoming : upcoming.slice(0, getLessonLookahead(dayMinutes)),
  });
}
