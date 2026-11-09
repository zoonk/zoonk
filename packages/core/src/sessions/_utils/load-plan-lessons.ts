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
  paceFactor = 1,
}: {
  item: LearnItem | null;
  lesson: LessonWithSkills;
  paceFactor?: number;
}): PlannedLesson {
  return {
    canDo: lesson.canDo,
    chapterId: item?.chapterId ?? lesson.homeChapterId,
    lessonId: lesson.id,
    minutes: Math.max(
      1,
      Math.round((lesson.estimatedMinutes || DEFAULT_LESSON_MINUTES) * paceFactor),
    ),
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
  paceFactor = 1,
  client = prisma,
}: {
  items: readonly LearnItem[];
  paceFactor?: number;
  client?: Pick<typeof prisma, "lesson">;
}): Promise<PlannedLesson[]> {
  const lessonIds = items.flatMap((item) => item.lessonId ?? []);

  if (lessonIds.length === 0) {
    return [];
  }

  const lessons = await client.lesson.findMany({
    include: LESSON_INCLUDE,
    where: { id: { in: lessonIds }, setAsideAt: null },
  });

  return items.flatMap((item) => {
    const lesson = lessons.find((candidate) => candidate.id === item.lessonId);
    return lesson ? [toPlannedLesson({ item, lesson, paceFactor })] : [];
  });
}

/** At most one lesson per skill, preserving supplied skill order. */
export async function loadLessonsForSkills({
  limit,
  skillIds,
  paceFactor = 1,
}: {
  limit: number;
  skillIds: readonly string[];
  paceFactor?: number;
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

  return unique
    .slice(0, limit)
    .map((lesson) => toPlannedLesson({ item: null, lesson, paceFactor }));
}

/** Look ahead after keptLessonIds so retained work cannot consume the window for newly landed lessons. */
function loadUpcomingLessons({
  dayMinutes,
  items,
  keptLessonIds,
  paceFactor,
}: Parameters<typeof loadPlanLessons>[0] & {
  dayMinutes: number;
  keptLessonIds?: ReadonlySet<string>;
}) {
  return loadPlanLessons({
    items: items
      .filter((item) => !item.lessonId || !keptLessonIds?.has(item.lessonId))
      .slice(0, getLessonLookahead(dayMinutes)),
    paceFactor,
  });
}

export async function loadDayPlanLessons({
  dayMinutes,
  fillItems,
  keptLessonIds,
  learnItems,
  paceFactor,
}: {
  dayMinutes: number;
  fillItems: readonly LearnItem[];
  keptLessonIds?: ReadonlySet<string>;
  learnItems: readonly LearnItem[];
  paceFactor?: number;
}) {
  const available = await loadUpcomingLessons({
    dayMinutes,
    items: [...learnItems, ...fillItems.filter((item) => !learnItems.includes(item))],
    keptLessonIds,
    paceFactor,
  });

  const allocated = new Set(learnItems.map((item) => getItemKey(item)));

  return {
    fillLessons: available.filter((lesson) => !allocated.has(lesson.planItemKey ?? "")),
    lessons: available.filter((lesson) => allocated.has(lesson.planItemKey ?? "")),
  };
}
