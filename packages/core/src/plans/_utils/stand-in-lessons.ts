import { OUTLINE_AHEAD_DAYS } from "../../lookahead/outline-ahead";
import { addDays, toIsoDate } from "../planner/plan-calendar";
import { isStandIn } from "../planner/plan-item-rules";
import { type ExistingPlanItem } from "../planner/plan-items";

type EstimatedItem = Pick<
  ExistingPlanItem,
  "chapterId" | "kind" | "lessonId" | "lessons" | "skillId"
>;

export function countItemLessons(item: EstimatedItem): number {
  return isStandIn(item) ? Math.max(1, item.lessons ?? 1) : 1;
}

export function countLessons(items: readonly EstimatedItem[]): number {
  return items.reduce((total, item) => total + countItemLessons(item), 0);
}

export function sumPlannedLessons(items: readonly EstimatedItem[]): number | null {
  const sizes = items.filter((item) => isStandIn(item)).map((item) => item.lessons ?? null);

  if (sizes.length === 0 || sizes.includes(null)) {
    return null;
  }

  return sizes.reduce((sum: number, size) => sum + Math.max(1, size ?? 1), 0);
}

export function getOutlinedUntil(today: Date): string {
  return toIsoDate(addDays(today, OUTLINE_AHEAD_DAYS));
}

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
 * The far row's topic to open: its first one no chapter teaches yet, whose outline it can write
 * early, else its first taught one, whose outline lists the chapters that now teach it.
 */
export function getFarTopicSkill({
  far,
  skillIds,
  taughtSkillIds,
}: {
  far: boolean;
  skillIds: readonly (string | null)[];
  taughtSkillIds: ReadonlySet<string>;
}): string | null {
  if (!far) {
    return null;
  }

  const topics = skillIds.filter((id) => id !== null);
  return topics.find((id) => !taughtSkillIds.has(id)) ?? topics[0] ?? null;
}
