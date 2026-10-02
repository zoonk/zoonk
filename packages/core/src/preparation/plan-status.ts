import { type PlanItemStatus } from "@zoonk/db";
import { daysBetween } from "../plans/planner/plan-calendar";

/** What the learner can change when the plan no longer fits. */
type PlanAdjustment = "addTime" | "moveDate" | "narrowScope";

/**
 * On track, ahead (by how many days), a bit behind (with the fix: extra minutes a day for a few
 * days) or needs adjusting (with the choices). Words for each live in the apps.
 */
export type PlanStatus =
  | { kind: "ahead"; days: number }
  | { kind: "behind"; days: number; extraMinutesPerDay: number }
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
  targetDate,
}: {
  items: readonly PlanStatusItem[];
  targetDate: Date | null;
}) {
  return (
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
 * target date. Past work is never counted twice: items finished early count as ahead. Returns null
 * while nothing is scheduled.
 */
export function getPlanStatus({
  items,
  minutesPerItem,
  targetDate,
  today,
}: {
  items: readonly PlanStatusItem[];
  minutesPerItem: number;
  targetDate: Date | null;
  /** The learner-local date, as a UTC-midnight label like `scheduledFor`. */
  today: Date;
}): PlanStatus | null {
  const scheduled = items.filter((item) => item.scheduledFor !== null);
  const days = new Set(scheduled.map((item) => item.scheduledFor?.getTime())).size;

  if (days === 0) {
    return null;
  }

  if (isPastTarget({ items, targetDate })) {
    return getNeedsAdjusting(targetDate);
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
    return { days: catchUpDays, extraMinutesPerDay: CATCH_UP_EXTRA_MINUTES, kind: "behind" };
  }

  return getNeedsAdjusting(targetDate);
}
