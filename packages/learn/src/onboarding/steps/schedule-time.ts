import { getBudgetForMainGoal, splitDailyBudget } from "@zoonk/core/goals/daily-budget";
import {
  type PlanSuggestedTime,
  type PlanTimeAdvice,
  type PlanTimeAdviceInput,
  type PlanTimeToCover,
} from "@zoonk/core/plans/time-advice-contract";

export type StudyWeek = Omit<PlanTimeAdviceInput, "dailyMinutes"> & { studyDays: number[] };

export type TimeLine =
  | { kind: "asking" }
  | { kind: "askFailed" }
  | { kind: "everyTopic" }
  | { kind: "everything"; suggested: boolean }
  | { kind: "findFailed" }
  | { kind: "finish"; endDate: string }
  | { kind: "noDays" }
  | { kind: "noFinish" }
  | { kind: "pastDate" }
  | { kind: "share"; share: number }
  | { kind: "working" };

export type DaySplit = { main: number; other: number; others: number };

function getMainShare({ goalCount, minutes }: { goalCount: number; minutes: number }): number {
  return splitDailyBudget({ budget: minutes, count: goalCount })[0] ?? minutes;
}

/** Goals typed together share the day's time, the main one the most: its plan answers for its share. */
export function toMainGoalWeek<Week extends StudyWeek & Pick<PlanTimeAdviceInput, "dailyMinutes">>({
  goalCount,
  week,
}: {
  goalCount: number;
  week: Week;
}): Week {
  const { dailyMinutes, weekendMinutes } = week;

  return {
    ...week,
    ...(dailyMinutes === undefined
      ? {}
      : { dailyMinutes: getMainShare({ goalCount, minutes: dailyMinutes }) }),
    ...(weekendMinutes === undefined
      ? {}
      : { weekendMinutes: getMainShare({ goalCount, minutes: weekendMinutes }) }),
  };
}

/** The times the main goal's plan found, as the day's time that gives the main goal them. */
export function toDayTime({
  goalCount,
  time,
}: {
  goalCount: number;
  time: PlanTimeToCover;
}): PlanTimeToCover {
  const toDay = (main: number | null) =>
    main === null ? null : getBudgetForMainGoal({ count: goalCount, main });

  return {
    ...time,
    coreMinutes: toDay(time.coreMinutes),
    recommendedMinutes: toDay(time.recommendedMinutes),
    suggested: time.suggested && {
      ...time.suggested,
      minutes: toDay(time.suggested.minutes) ?? time.suggested.minutes,
    },
  };
}

export function getDaySplit({
  goalCount,
  minutes,
}: {
  goalCount: number;
  minutes: number | null;
}): DaySplit | null {
  if (goalCount < 2 || minutes === null) {
    return null;
  }

  const [main = minutes, other = 0] = splitDailyBudget({ budget: minutes, count: goalCount });
  return { main, other, others: goalCount - 1 };
}

export function toStudyWeek({
  days,
  fullCourse = false,
  minutes,
  weekend,
}: {
  days: number[];
  fullCourse?: boolean;
  minutes: number;
  weekend: number | null;
}): StudyWeek {
  const week =
    weekend === null || weekend === minutes
      ? { studyDays: days }
      : { studyDays: days, weekendMinutes: weekend };

  return fullCourse ? { ...week, fullCourse } : week;
}

/** The weekend's own time stays even when it equals the weekdays': only the weekdays' time is searched. */
export function toFindWeek({
  days,
  weekend,
}: {
  days: number[];
  weekend: number | null;
}): StudyWeek {
  return weekend === null ? { studyDays: days } : { studyDays: days, weekendMinutes: weekend };
}

export function getSuggestedMinutes(found: PlanTimeToCover | null): number | null {
  return found?.suggested?.minutes ?? null;
}

/**
 * Null while the first time is still being worked out: no other time is shown in its place. The time
 * follows the suggestion as the days change only when the screen started on one; `settled` says none
 * is coming (no date, or asking failed), so the screen's own time shows.
 */
export function getShownMinutes({
  fallback,
  first,
  found,
  picked,
  settled,
}: {
  fallback: number;
  first: PlanTimeToCover | null;
  found: PlanTimeToCover | null;
  picked: number | null;
  settled: boolean;
}): number | null {
  if (picked !== null) {
    return picked;
  }

  if (!first) {
    return settled ? fallback : null;
  }

  const firstSuggested = getSuggestedMinutes(first);

  if (firstSuggested === null) {
    return fallback;
  }

  return getSuggestedMinutes(found) ?? firstSuggested;
}

/** The time shown is a suggestion it follows, still the one for the days before: Continue waits for the new one. */
export function waitsForSuggestion({
  failed,
  first,
  found,
  picked,
}: {
  failed: boolean;
  first: PlanTimeToCover | null;
  found: PlanTimeToCover | null;
  picked: number | null;
}): boolean {
  return picked === null && found === null && !failed && getSuggestedMinutes(first) !== null;
}

/** Picking the suggested time again follows the suggestion as the days change, where it's followed. */
export function toPickedMinutes({
  first,
  found,
  minutes,
}: {
  first: PlanTimeToCover | null;
  found: PlanTimeToCover | null;
  minutes: number;
}): number | null {
  const follows = getSuggestedMinutes(first) !== null;
  return follows && getSuggestedMinutes(found) === minutes ? null : minutes;
}

/** Why no suggestion covers everything; null when one does, the time shown does, or the date passed. */
export function getTooClose({
  found,
  line,
}: {
  found: PlanTimeToCover | null;
  line: TimeLine;
}): { recommendedMinutes: number | null } | null {
  if (
    !found ||
    found.pastDate ||
    line.kind === "everything" ||
    found.suggested?.kind === "everything"
  ) {
    return null;
  }

  return { recommendedMinutes: found.recommendedMinutes };
}

/** Only while the time shown falls short of everything. */
export function getOffer({
  found,
  line,
  minutes,
}: {
  found: PlanTimeToCover | null;
  line: TimeLine;
  minutes: number | null;
}): PlanSuggestedTime | null {
  const suggested = found?.suggested ?? null;

  return suggested && suggested.minutes !== minutes && line.kind !== "everything"
    ? suggested
    : null;
}

function getDatedLine({
  advice,
  askFailed,
  findFailed,
  found,
  minutes,
}: {
  advice: PlanTimeAdvice | null;
  askFailed: boolean;
  findFailed: boolean;
  found: PlanTimeToCover | null;
  minutes: number;
}): TimeLine {
  if (!found) {
    return { kind: findFailed ? "findFailed" : "working" };
  }

  if (found.pastDate) {
    return { kind: "pastDate" };
  }

  const { suggested } = found;

  if (suggested?.minutes === minutes) {
    return suggested.kind === "everything"
      ? { kind: "everything", suggested: true }
      : { kind: "everyTopic" };
  }

  if (!advice) {
    return { kind: askFailed ? "askFailed" : "asking" };
  }

  const share = advice.coveredShare ?? 0;
  return share >= 1 ? { kind: "everything", suggested: false } : { kind: "share", share };
}

function getFinishLine({
  advice,
  askFailed,
}: {
  advice: PlanTimeAdvice | null;
  askFailed: boolean;
}): TimeLine {
  if (!advice) {
    return { kind: askFailed ? "askFailed" : "asking" };
  }

  return advice.endDate ? { endDate: advice.endDate, kind: "finish" } : { kind: "noFinish" };
}

/**
 * `found` is the plan's answer for the days shown, `advice` its answer for the time shown on them;
 * either is null while it's being asked for.
 */
export function getTimeLine({
  advice,
  askFailed,
  dated,
  findFailed,
  found,
  hasDays,
  minutes,
}: {
  advice: PlanTimeAdvice | null;
  askFailed: boolean;
  dated: boolean;
  findFailed: boolean;
  found: PlanTimeToCover | null;
  hasDays: boolean;
  minutes: number | null;
}): TimeLine {
  if (!hasDays) {
    return { kind: "noDays" };
  }

  if (minutes === null) {
    return { kind: "working" };
  }

  return dated
    ? getDatedLine({ advice, askFailed, findFailed, found, minutes })
    : getFinishLine({ advice, askFailed });
}

/** The time picked needs the plan's own answer, except the one it suggested. */
export function asksAboutTime({
  dated,
  found,
  fullCourse,
  minutes,
}: {
  dated: boolean;
  found: PlanTimeToCover | null;
  fullCourse: boolean;
  minutes: number | null;
}): boolean {
  if (minutes === null) {
    return false;
  }

  if (!dated) {
    return true;
  }

  if (!found || found.pastDate) {
    return false;
  }

  return fullCourse || found.suggested?.minutes !== minutes;
}

/** An exam's choice to study everything holds until the time picked is known to cover it all. */
export function keepsFullCourse({ checked, line }: { checked: boolean; line: TimeLine }): boolean {
  return checked && line.kind !== "everything";
}
