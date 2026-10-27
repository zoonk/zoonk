import "server-only";
import { type Lesson, prisma } from "@zoonk/db";
import { getItemKey } from "../../plans/planner/plan-items";
import { DEFAULT_LESSON_MINUTES } from "../../plans/planner/plan-units";
import { type PlannedLesson } from "../session-builder";
import { getLessonLookahead } from "./day-lessons";
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

/** Resolves selected lesson rows; deleted, set-aside and unoutlined lessons have nothing to teach. */
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

/** Lessons that teach skills, for reinforcement before a boss rematch: one per skill, in order. */
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
 * The upcoming lessons the builder chooses from (see `getLessonLookahead`), after the lessons the
 * day keeps: those would take the places of the ones that come next.
 */
export function loadUpcomingLessons({
  dayMinutes,
  items,
  keptLessonIds,
}: Parameters<typeof loadPlanLessons>[0] & {
  dayMinutes: number;
  keptLessonIds?: ReadonlySet<string>;
}) {
  return loadPlanLessons({
    items: items
      .filter((item) => !item.lessonId || !keptLessonIds?.has(item.lessonId))
      .slice(0, getLessonLookahead(dayMinutes)),
  });
}
