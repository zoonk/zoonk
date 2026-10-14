import { type Goal } from "@zoonk/db";
import {
  countChallengesLeft,
  countLessonsLeft,
  isDateReached,
  isPlanFinished,
} from "../plans/_utils/plan-end";
import { daysBetween } from "../plans/planner/plan-calendar";
import { type ExistingPlanItem } from "../plans/planner/plan-items";

/** What the learner can change when the plan no longer fits. */
type PlanAdjustment = "addTime" | "moveDate" | "narrowScope";

/**
 * The learner's pace against their plan: keeping pace, ahead (by how many days), a bit behind
 * (with the fix: extra minutes a day for a few days), needs adjusting (with the choices), past its
 * date with lessons left, every lesson done with phases' challenges left, or finished once every
 * lesson and challenge is (see `isPlanFinished`). It never says whether the plan reaches the goal
 * (see `PlanFeasibility`). Words for each live in the apps.
 */
export type PlanStatus =
  | { kind: "ahead"; days: number }
  /**
   * `lessons`: lessons earlier days left that the learner hasn't caught up on yet (they come first
   * in the plan); null when the plan's dates alone say how far behind it is.
   */
  | { kind: "behind"; days: number; extraMinutesPerDay: number; lessons: number | null }
  /**
   * Every lesson is done (its number reads 100%) and `challenges` phases' challenges are left: the
   * plan finishes once they're won (see `countChallengesLeft`).
   */
  | { kind: "challengesLeft"; challenges: number }
  | { kind: "finished" }
  | { kind: "needsAdjusting"; options: PlanAdjustment[] }
  | { kind: "onTrack" }
  /**
   * The plan's date came (see `isDateReached`) with `lessons` left, to do or set aside: the plan
   * doesn't end, it waits for the learner to adjust it (see `PlanView.pastDateOffer`).
   */
  | { kind: "pastDate"; lessons: number };

/** A plan item as the pace reads it: its day and status, and what it counts as in lessons. */
export type PlanStatusItem = Pick<
  ExistingPlanItem,
  "chapterId" | "kind" | "lessonId" | "lessons" | "scheduledFor" | "skillId" | "status"
>;

/** The plan item fields `PlanStatusItem` reads, for a Prisma select. */
export const PLAN_STATUS_ITEM_SELECT = {
  chapterId: true,
  kind: true,
  lessonId: true,
  lessons: true,
  scheduledFor: true,
  skillId: true,
  status: true,
} as const;

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
 * say: a new day moves them first, so the dates alone would read as keeping pace. A plan whose
 * every lesson is studied or tested out and every challenge won is finished, whatever its dates:
 * Pedro's plan, done two weeks early, read "13 days ahead" beside "You finished your plan". One
 * whose date came with lessons left is past its date, never "Ended": Lucas's plan stopped there
 * with 13 lessons he never studied. One whose every lesson is done with challenges left says so,
 * even past its date, never "Too tight": Pedro's read "Finished" beside "0 of 4 phases done".
 * Returns null while nothing is scheduled, and for a plan only Plus moves (`freeWeekOver`).
 */
export function getPlanStatus({
  phaseChallengesRequired = true,
  catchUp = 0,
  freeWeekOver = false,
  goalKind,
  items,
  minutesPerItem,
  studiesPastTarget = false,
  targetDate,
  today,
}: {
  phaseChallengesRequired?: boolean;
  /** Lessons earlier days left that aren't done yet (see `loadCatchUpItems`). */
  catchUp?: number;
  /**
   * A free exam plan past its first week (`ExamPrepAccess.trialEnded`): its new lessons come with
   * Plus, so it has no pace to keep and nothing to catch up on.
   */
  freeWeekOver?: boolean;
  goalKind: Goal["kind"];
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
  if (
    isPlanFinished({
      goalKind,
      items,
      phaseChallengesRequired,
      studiesPastTarget,
      targetDate,
      today,
    })
  ) {
    return { kind: "finished" };
  }

  if (freeWeekOver) {
    return null;
  }

  const lessons = countLessonsLeft(items);

  if (lessons > 0 && isDateReached({ studiesPastTarget, targetDate, today })) {
    return { kind: "pastDate", lessons };
  }

  const challenges = countChallengesLeft({
    goalKind,
    items,
    phaseChallengesRequired,
    studiesPastTarget,
    targetDate,
    today,
  });

  if (challenges > 0) {
    return { challenges, kind: "challengesLeft" };
  }

  const required = phaseChallengesRequired ? items : items.filter((item) => item.kind !== "boss");
  const scheduled = required.filter((item) => item.scheduledFor !== null);
  const days = new Set(scheduled.map((item) => item.scheduledFor?.getTime())).size;

  if (days === 0) {
    return null;
  }

  if (isPastTarget({ items: required, studiesPastTarget, targetDate })) {
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

  if (
    catchUpDays <= MAX_CATCH_UP_DAYS &&
    catchUpDays <= (targetDate ? daysBetween(today, targetDate) : Number.POSITIVE_INFINITY)
  ) {
    return {
      days: catchUpDays,
      extraMinutesPerDay: CATCH_UP_EXTRA_MINUTES,
      kind: "behind",
      lessons: null,
    };
  }

  return getNeedsAdjusting(targetDate);
}
