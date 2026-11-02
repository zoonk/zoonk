import { type Goal } from "@zoonk/db";
import {
  areLessonsFinished,
  countChallengesLeft,
  countLessonsLeft,
  hasChallengeLeftOut,
  isDateReached,
  isPlanFinished,
} from "../plans/_utils/plan-end";
import { daysBetween } from "../plans/planner/plan-calendar";
import { type ExistingPlanItem } from "../plans/planner/plan-items";
import { type PlanPhase } from "../plans/planner/plan-state";

type PlanAdjustment = "addTime" | "moveDate" | "narrowScope";

type PlanLifecycle =
  | { challenges: number; kind: "challengesLeft" }
  | { kind: "finished" }
  | { kind: "needsAdjusting"; options: PlanAdjustment[] }
  | { kind: "pastDate"; lessons: number };

type PlanPace =
  | { days: number; kind: "ahead" }
  | { kind: "onPace" }
  | { catchUp: null; kind: "behind"; lessons: number }
  | { catchUp: { days: number; extraMinutesPerDay: number } | null; kind: "behind"; lessons: null };

export type PlanStatus =
  | { kind: "ahead"; days: number }
  /**
   * Lessons earlier days left that the learner hasn't caught up on; null when the plan's dates
   * alone say how far behind it is.
   */
  | { kind: "behind"; days: number; extraMinutesPerDay: number; lessons: number | null }
  | { kind: "challengesLeft"; challenges: number }
  | { kind: "finished" }
  | { kind: "needsAdjusting"; options: PlanAdjustment[] }
  | { kind: "onTrack" }
  | { kind: "pastDate"; lessons: number };

export type PlanStatusItem = Pick<
  ExistingPlanItem,
  "chapterId" | "kind" | "lessonId" | "lessons" | "scheduledFor" | "skillId" | "status"
>;

const CATCH_UP_EXTRA_MINUTES = 10;
const MAX_CATCH_UP_DAYS = 7;

const DEFAULT_MINUTES_PER_PLAN_ITEM = 4;
const MINUTES_PER_HOUR = 60;

const isFinished = (item: PlanStatusItem) => item.status !== "todo";

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

function getPlanAdjustments(targetDate: Date | null): PlanAdjustment[] {
  const options: PlanAdjustment[] = ["addTime", "narrowScope"];
  return targetDate ? [...options, "moveDate"] : options;
}

function getNeedsAdjusting(targetDate: Date | null): PlanStatus {
  return { kind: "needsAdjusting", options: getPlanAdjustments(targetDate) };
}

function listRequired({
  items,
  phaseChallengesRequired,
}: {
  items: readonly PlanStatusItem[];
  phaseChallengesRequired: boolean;
}) {
  return phaseChallengesRequired ? items : items.filter((item) => item.kind !== "boss");
}

function hasWorkAfterDate({
  items,
  phaseChallengesRequired,
  studiesPastTarget,
  targetDate,
}: {
  items: readonly PlanStatusItem[];
  phaseChallengesRequired: boolean;
  studiesPastTarget: boolean;
  targetDate: Date | null;
}): boolean {
  return (
    !studiesPastTarget &&
    targetDate !== null &&
    listRequired({ items, phaseChallengesRequired }).some(
      (item) => !isFinished(item) && item.scheduledFor && item.scheduledFor > targetDate,
    )
  );
}

/**
 * Today's items count only once finished: not studying yet today isn't behind, and doing today's
 * work isn't ahead.
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

function getPlanLifecycle({
  freeWeekOver,
  goalKind,
  items,
  phaseChallengesRequired,
  phases,
  studiesPastTarget,
  targetDate,
  today,
}: {
  freeWeekOver: boolean;
  goalKind: Goal["kind"];
  items: readonly PlanStatusItem[];
  phaseChallengesRequired: boolean;
  phases: readonly Pick<PlanPhase, "challengeLeftOut">[];
  studiesPastTarget: boolean;
  targetDate: Date | null;
  today: Date;
}): PlanLifecycle | null {
  const ends = {
    goalKind,
    items,
    phaseChallengesRequired,
    phases,
    studiesPastTarget,
    targetDate,
    today,
  };

  if (isPlanFinished(ends)) {
    return { kind: "finished" };
  }

  if (freeWeekOver) {
    return null;
  }

  const lessons = countLessonsLeft(items);

  if (lessons > 0 && isDateReached({ studiesPastTarget, targetDate, today })) {
    return { kind: "pastDate", lessons };
  }

  // Winning what's on the calendar can't finish it: it needs more study days or a later date.
  if (hasChallengeLeftOut(ends) && areLessonsFinished(ends)) {
    return { kind: "needsAdjusting", options: targetDate ? ["addTime", "moveDate"] : ["addTime"] };
  }

  const challenges = countChallengesLeft(ends);
  return challenges > 0 ? { challenges, kind: "challengesLeft" } : null;
}

function getPlanPace({
  catchUp,
  freeWeekOver,
  items,
  minutesPerItem,
  phaseChallengesRequired,
  targetDate,
  today,
}: {
  catchUp: number;
  freeWeekOver: boolean;
  items: readonly PlanStatusItem[];
  minutesPerItem: number;
  phaseChallengesRequired: boolean;
  targetDate: Date | null;
  today: Date;
}): PlanPace | null {
  const scheduled = listRequired({ items, phaseChallengesRequired }).filter(
    (item) => item.scheduledFor !== null,
  );

  const days = new Set(scheduled.map((item) => item.scheduledFor?.getTime())).size;

  if (freeWeekOver || days === 0) {
    return null;
  }

  if (catchUp > 0) {
    return { catchUp: null, kind: "behind", lessons: catchUp };
  }

  const itemsPerDay = scheduled.length / days;
  const expected = scheduled.filter((item) => isDue({ item, today })).length;
  const lead = scheduled.filter((item) => isFinished(item)).length - expected;

  if (lead >= itemsPerDay) {
    return { days: Math.floor(lead / itemsPerDay), kind: "ahead" };
  }

  if (lead > -itemsPerDay) {
    return { kind: "onPace" };
  }

  const catchUpDays = Math.ceil((-lead * minutesPerItem) / CATCH_UP_EXTRA_MINUTES);

  const fits =
    catchUpDays <= MAX_CATCH_UP_DAYS &&
    catchUpDays <= (targetDate ? daysBetween(today, targetDate) : Number.POSITIVE_INFINITY);

  return {
    catchUp: fits ? { days: catchUpDays, extraMinutesPerDay: CATCH_UP_EXTRA_MINUTES } : null,
    kind: "behind",
    lessons: null,
  };
}

export function getPlanStatus({
  phaseChallengesRequired = true,
  catchUp = 0,
  freeWeekOver = false,
  goalKind,
  items,
  minutesPerItem,
  phases = [],
  studiesPastTarget = false,
  targetDate,
  today,
}: {
  phaseChallengesRequired?: boolean;
  catchUp?: number;
  freeWeekOver?: boolean;
  goalKind: Goal["kind"];
  items: readonly PlanStatusItem[];
  minutesPerItem: number;
  phases?: readonly Pick<PlanPhase, "challengeLeftOut">[];
  studiesPastTarget?: boolean;
  targetDate: Date | null;
  /** The learner-local date, as a UTC-midnight label like `scheduledFor`. */
  today: Date;
}): PlanStatus | null {
  const lifecycle = getPlanLifecycle({
    freeWeekOver,
    goalKind,
    items,
    phaseChallengesRequired,
    phases,
    studiesPastTarget,
    targetDate,
    today,
  });

  if (lifecycle) {
    return lifecycle;
  }

  const pace = getPlanPace({
    catchUp,
    freeWeekOver,
    items,
    minutesPerItem,
    phaseChallengesRequired,
    targetDate,
    today,
  });

  if (!pace) {
    return null;
  }

  if (hasWorkAfterDate({ items, phaseChallengesRequired, studiesPastTarget, targetDate })) {
    return getNeedsAdjusting(targetDate);
  }

  if (pace.kind === "onPace") {
    return { kind: "onTrack" };
  }

  if (pace.kind === "ahead") {
    return pace;
  }

  if (pace.lessons !== null) {
    return { days: 0, extraMinutesPerDay: 0, kind: "behind", lessons: pace.lessons };
  }

  return pace.catchUp
    ? { ...pace.catchUp, kind: "behind", lessons: null }
    : getNeedsAdjusting(targetDate);
}
