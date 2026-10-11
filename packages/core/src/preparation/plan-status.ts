import { type PlanItemStatus } from "@zoonk/db";
import { daysBetween } from "../plans/planner/plan-calendar";

/** What the learner can change when the plan no longer fits. */
type PlanAdjustment = "addTime" | "moveDate" | "narrowScope";

/**
 * The learner's pace against their plan: keeping pace, ahead (by how many days), a bit behind
 * (with the fix: extra minutes a day for a few days) or needs adjusting (with the choices). It
 * never says whether the plan reaches the goal (see `PlanFeasibility`). Words for each live in the
 * apps.
 */
export type PlanStatus =
  | { kind: "ahead"; days: number }
  /**
   * `lessons`: lessons earlier days left that the learner hasn't caught up on yet (they come first
   * in the plan); null when the plan's dates alone say how far behind it is.
   */
  | { kind: "behind"; days: number; extraMinutesPerDay: number; lessons: number | null }
  | { kind: "needsAdjusting"; options: PlanAdjustment[] }
  | { kind: "onTrack" };

export type PlanStatusItem = { scheduledFor: Date | null; status: PlanItemStatus };

/** "10 more minutes a day for 4 days" fixes a small delay; more than a week of that doesn't. */
const CATCH_UP_EXTRA_MINUTES = 10;
const MAX_CATCH_UP_DAYS = 7;

/** A 3-minute lesson plus reviews and practice around it, when the plan has no estimate yet. */
const DEFAULT_MINUTES_PER_PLAN_ITEM = 4;
const MINUTES_PER_HOUR = 60;

const isFinished = (item: PlanStatusItem) => item.status !== "todo";

/** The average study time of one plan item, from the plan's estimate. */
export function getMinutesPerItem({
  estimateHours,
  itemCount,
}: {
  estimateHours: number | null;
  itemCount: number;
}) {
  return estimateHours && itemCount > 0
    ? (estimateHours * MINUTES_PER_HOUR) / itemCount
    : DEFAULT_MINUTES_PER_PLAN_ITEM;
}

function getNeedsAdjusting(targetDate: Date | null): PlanStatus {
  const options: PlanAdjustment[] = ["addTime", "narrowScope"];
  return { kind: "needsAdjusting", options: targetDate ? [...options, "moveDate"] : options };
}

function isPastTarget({
  items,
  studiesPastTarget,
  targetDate,
}: {
  items: readonly PlanStatusItem[];
  studiesPastTarget: boolean;
  targetDate: Date | null;
}) {
  return (
    !studiesPastTarget &&
    targetDate !== null &&
    items.some((item) => !isFinished(item) && item.scheduledFor && item.scheduledFor > targetDate)
  );
}

/**
 * Past days' items are due. Today's count once finished, so a learner who hasn't studied yet today
 * isn't behind, and one who has isn't ahead for doing today's work.
 */
function isDue({ item, today }: { item: PlanStatusItem; today: Date }): boolean {
  if (!item.scheduledFor) {
    return false;
  }

  return (
    item.scheduledFor < today ||
    (item.scheduledFor.getTime() === today.getTime() && isFinished(item))
  );
}

/**
 * Compares finished plan items with those due by today. A day's worth of items either way
 * is the tolerance; beyond it the learner is ahead, or behind with a fix that fits before the
 * target date. Past work is never counted twice: items finished early count as ahead. Lessons
 * earlier days left (`catchUp`) mean the learner is behind until they're done, whatever the dates
 * say: a new day moves them first, so the dates alone would read as keeping pace. Returns null while
 * nothing is scheduled, and for a plan only Plus moves (`freeWeekOver`).
 */
export function getPlanStatus({
  catchUp = 0,
  freeWeekOver = false,
  items,
  minutesPerItem,
  studiesPastTarget = false,
  targetDate,
  today,
}: {
  /** Lessons earlier days left that aren't done yet (see `loadCatchUpItems`). */
  catchUp?: number;
  /**
   * A free exam plan past its first week (`ExamPrepAccess.trialEnded`): its new lessons come with
   * Plus, so it has no pace to keep and nothing to catch up on.
   */
  freeWeekOver?: boolean;
  items: readonly PlanStatusItem[];
  minutesPerItem: number;
  /**
   * The learner chose to go on after the date (an exam's "Study everything", see
   * `PlanSettings.fullCourse`): what comes after it is their plan, not a plan that no longer fits.
   */
  studiesPastTarget?: boolean;
  targetDate: Date | null;
  /** The learner-local date, as a UTC-midnight label like `scheduledFor`. */
  today: Date;
}): PlanStatus | null {
  const scheduled = items.filter((item) => item.scheduledFor !== null);
  const days = new Set(scheduled.map((item) => item.scheduledFor?.getTime())).size;

  if (freeWeekOver || days === 0) {
    return null;
  }

  if (isPastTarget({ items, studiesPastTarget, targetDate })) {
    return getNeedsAdjusting(targetDate);
  }

  if (catchUp > 0) {
    return { days: 0, extraMinutesPerDay: 0, kind: "behind", lessons: catchUp };
  }

  const itemsPerDay = scheduled.length / days;

  const expected = scheduled.filter((item) => isDue({ item, today })).length;

  const lead = scheduled.filter((item) => isFinished(item)).length - expected;

  if (lead >= itemsPerDay) {
    return { days: Math.floor(lead / itemsPerDay), kind: "ahead" };
  }

  if (lead > -itemsPerDay) {
    return { kind: "onTrack" };
  }

  const catchUpDays = Math.ceil((-lead * minutesPerItem) / CATCH_UP_EXTRA_MINUTES);

  const daysLeft = targetDate ? daysBetween(today, targetDate) : Number.POSITIVE_INFINITY;

  if (catchUpDays <= MAX_CATCH_UP_DAYS && catchUpDays <= daysLeft) {
    return {
      days: catchUpDays,
      extraMinutesPerDay: CATCH_UP_EXTRA_MINUTES,
      kind: "behind",
      lessons: null,
    };
  }

  return getNeedsAdjusting(targetDate);
}
