import { OUTLINE_AHEAD_DAYS } from "../../lookahead/outline-ahead";
import { addDays, toIsoDate } from "../planner/plan-calendar";
import { type ExistingPlanItem } from "../planner/plan-items";

type EstimatedItem = Pick<
  ExistingPlanItem,
  "chapterId" | "kind" | "lessonId" | "lessons" | "skillId"
>;

/** An item standing in for a skill's lessons not written yet: no lesson, no chapter, its skill. */
export function isStandIn(item: Omit<EstimatedItem, "lessons">): boolean {
  return item.kind === "lesson" && !item.lessonId && !item.chapterId && Boolean(item.skillId);
}

/**
 * How many lessons a plan item is: one for a lesson, and for a stand-in, the lessons of its skill
 * the plan teaches in its place, after cuts and base choices, as the plan saved them (at least
 * one; one item when a plan saved before it stored them). A stand-in once said its skill's whole
 * size: "about 25 lessons" for a topic the plan, short on time, teaches three lessons of.
 */
export function countItemLessons(item: EstimatedItem): number {
  return isStandIn(item) ? Math.max(1, item.lessons ?? 1) : 1;
}

/** How many lessons the items are (`countItemLessons`), the count every screen says. */
export function countLessons(items: readonly EstimatedItem[]): number {
  return items.reduce((total, item) => total + countItemLessons(item), 0);
}

/**
 * The lessons the plan teaches a row's stand-ins, as it saved them. Null when one of them has no
 * saved size (a plan saved before it stored them, until its next change), so the row says no
 * count rather than a false one, and for a row without stand-ins.
 */
export function sumPlannedLessons(items: readonly EstimatedItem[]): number | null {
  const sizes = items.filter((item) => isStandIn(item)).map((item) => item.lessons ?? null);

  if (sizes.length === 0 || sizes.includes(null)) {
    return null;
  }

  return sizes.reduce((sum: number, size) => sum + Math.max(1, size ?? 1), 0);
}

/**
 * The last day the plan writes lessons ahead for (`OUTLINE_AHEAD_DAYS` from the learner's today):
 * the lessons of a topic before it are on the way, and a topic after it can be asked for early.
 */
export function getOutlinedUntil(today: Date): string {
  return toIsoDate(addDays(today, OUTLINE_AHEAD_DAYS));
}

/**
 * A topic whose lessons aren't written yet (`writing`) and start after the weeks the plan writes
 * ahead (`getOutlinedUntil`): its row says what the plan knows about it rather than that its
 * lessons are on the way. False when the caller doesn't say how far ahead the plan writes.
 */
export function isFarTopic({
  nextDate,
  outlinedUntil,
  writing,
}: {
  nextDate: string | null;
  outlinedUntil?: string | null;
  writing: boolean;
}): boolean {
  return Boolean(writing && nextDate && outlinedUntil && nextDate > outlinedUntil);
}

/**
 * The skill to ask a far topic's lessons by early (`isFarTopic`): the first of its skills no
 * chapter teaches yet. A skill chapters already teach (`taughtSkillIds`, see
 * `listTaughtStandInSkills`) gets its next chapter as the learner gets close
 * (`listSkillExtensions`), and asking for it early only read back the chapters the plan lists
 * already. Null when none is left to ask for.
 */
export function getOpenEarlySkill({
  far,
  skillIds,
  taughtSkillIds,
}: {
  far: boolean;
  skillIds: readonly (string | null)[];
  taughtSkillIds: ReadonlySet<string>;
}): string | null {
  return far ? (skillIds.find((id) => id !== null && !taughtSkillIds.has(id)) ?? null) : null;
}
