import { type PlanItem } from "@zoonk/db";
import { type PlanGraph } from "../../plans/planner/plan-state";
import { DEFAULT_LESSON_MINUTES } from "../../plans/planner/plan-units";

/** Upcoming lessons the builder chooses from on a short day; it takes what fits. */
const LESSON_LOOKAHEAD = 8;

/**
 * Enough upcoming lessons to fill the day: a lesson for every few of its minutes, so a two-hour
 * day gets its whole study cycle (each subject's block) and not only its first eight lessons.
 */
export function getLessonLookahead(dayMinutes: number): number {
  return Math.max(LESSON_LOOKAHEAD, Math.ceil(dayMinutes / DEFAULT_LESSON_MINUTES));
}

type DayItem = Pick<PlanItem, "chapterId" | "lessonId" | "scheduledFor" | "skillId">;

/** A stand-in: lessons of a skill the Library hasn't outlined yet, with nothing to open now. */
function isStandIn(item: DayItem): boolean {
  return item.lessonId === null && item.chapterId === null && item.skillId !== null;
}

/**
 * Whether lessons due by today are still being outlined (stand-ins due by today): the day holds
 * their time, and they join its end once they land (`refreshDayFromPlan`).
 */
export function hasStandInsDue({
  items,
  today,
}: {
  items: readonly DayItem[];
  today: Date;
}): boolean {
  return items.some(
    (item) => isStandIn(item) && item.scheduledFor !== null && item.scheduledFor <= today,
  );
}

/**
 * The lessons a day draws from, in plan order; a stand-in has nothing to open, so it's never one
 * of them. While lessons due by today are still being outlined (`hasStandInsDue`), the day takes
 * only the lessons due by today: the stand-ins' time stays theirs, instead of later lessons filling
 * it and the day changing under the learner once they land. Otherwise an exam's day takes the ones
 * due by today, then, for the time they leave (a first day has no reviews yet), the next lessons
 * of the same subjects, so the day keeps to its study cycle's few subjects instead of starting
 * tomorrow's. Other goals follow the plan's order, and a day with nothing due does too.
 */
export function pickDayLessonItems<TItem extends DayItem>({
  graph,
  isExam,
  items,
  today,
}: {
  graph: PlanGraph;
  isExam: boolean;
  items: readonly TItem[];
  today: Date;
}): readonly TItem[] {
  const lessons = items.filter((item) => !isStandIn(item));
  const due = lessons.filter((item) => item.scheduledFor !== null && item.scheduledFor <= today);

  if (hasStandInsDue({ items, today })) {
    return due;
  }

  if (!isExam || due.length === 0) {
    return lessons;
  }

  const areas = new Map(graph.skills.map((skill) => [skill.skillId, skill.area]));
  const dayAreas = new Set(due.map((item) => areas.get(item.skillId ?? "")));

  const sameSubjects = lessons.filter(
    (item) => !due.includes(item) && dayAreas.has(areas.get(item.skillId ?? "")),
  );

  return [...due, ...sameSubjects];
}
