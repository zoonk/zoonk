import {
  type PlanTimeAdvice,
  type PlanTimeAdviceInput,
  type PlanTimeToCover,
} from "@zoonk/core/plans/time-advice-contract";

export type StudyWeek = Omit<PlanTimeAdviceInput, "dailyMinutes"> & { studyDays: number[] };

export type FoundTime = PlanTimeToCover & { pastDate: boolean };

/** More time a day than this is never a learner's starting time, even when it's what covers it all. */
const LONGEST_SUGGESTED_MINUTES = 240;

export type SuggestedTime = { kind: "everyTopic" | "everything"; minutes: number };

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

function getSuggestedTime(
  found: Pick<PlanTimeToCover, "coreMinutes" | "recommendedMinutes">,
): SuggestedTime | null {
  const { coreMinutes, recommendedMinutes } = found;

  if (recommendedMinutes !== null && recommendedMinutes <= LONGEST_SUGGESTED_MINUTES) {
    return { kind: "everything", minutes: recommendedMinutes };
  }

  if (coreMinutes !== null && coreMinutes <= LONGEST_SUGGESTED_MINUTES) {
    return { kind: "everyTopic", minutes: coreMinutes };
  }

  return null;
}

export function getSuggestedMinutes(found: FoundTime | null): number | null {
  return found && !found.pastDate ? (getSuggestedTime(found)?.minutes ?? null) : null;
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
  first: FoundTime | null;
  found: FoundTime | null;
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

/** Picking the suggested time again follows the suggestion as the days change, where it's followed. */
export function toPickedMinutes({
  first,
  found,
  minutes,
}: {
  first: FoundTime | null;
  found: FoundTime | null;
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
  found: FoundTime | null;
  line: TimeLine;
}): { recommendedMinutes: number | null } | null {
  if (
    !found ||
    found.pastDate ||
    line.kind === "everything" ||
    getSuggestedTime(found)?.kind === "everything"
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
  found: FoundTime | null;
  line: TimeLine;
  minutes: number | null;
}): SuggestedTime | null {
  const suggested = found && !found.pastDate ? getSuggestedTime(found) : null;

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
  found: FoundTime | null;
  minutes: number;
}): TimeLine {
  if (!found) {
    return { kind: findFailed ? "findFailed" : "working" };
  }

  if (found.pastDate) {
    return { kind: "pastDate" };
  }

  const suggested = getSuggestedTime(found);

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
  found: FoundTime | null;
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
  found: FoundTime | null;
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

  return fullCourse || getSuggestedTime(found)?.minutes !== minutes;
}

/** An exam's choice to study everything holds until the time picked is known to cover it all. */
export function keepsFullCourse({ checked, line }: { checked: boolean; line: TimeLine }): boolean {
  return checked && line.kind !== "everything";
}
