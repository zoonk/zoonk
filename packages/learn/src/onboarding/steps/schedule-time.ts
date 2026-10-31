import {
  type PlanTimeAdvice,
  type PlanTimeAdviceInput,
  type PlanTimeToCover,
} from "@zoonk/core/plans/time-advice-contract";

export type StudyWeek = Omit<PlanTimeAdviceInput, "dailyMinutes"> & { studyDays: number[] };

export type TimeLine =
  | { kind: "asking" }
  | { kind: "askFailed" }
  | { kind: "everything"; suggested: boolean }
  | { kind: "findFailed" }
  | { kind: "finish"; endDate: string }
  | { coveredShare: number; everyTopic: boolean; kind: "focus" }
  | { kind: "noDays" }
  | { kind: "noFinish" }
  | { kind: "pastDate" }
  | { kind: "share"; share: number }
  | { kind: "working" };

const BUSY_LINES = new Set<TimeLine["kind"]>(["asking", "working"]);

export function isBusyLine(line: TimeLine): boolean {
  return BUSY_LINES.has(line.kind);
}

/** The goals typed together share the day's time; `place` is the shown goal's among them, the main one 0. */
export type GoalsTogether = { count: number; place: number };

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

/** Continue saves only a time the learner picked, or one the screen has said what it covers. */
export function waitsToSave({ line, picked }: { line: TimeLine; picked: number | null }): boolean {
  return picked === null && isBusyLine(line);
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

export type FullTimeNote =
  | { kind: "takes"; minutes: number | null; moreDays: boolean }
  | { kind: "tooLong" };

/**
 * When the suggestion is a focus: what covering everything takes while the time shown falls short
 * of it, or that the time shown, which covers it all, is more than most people keep up. More days
 * bring the time down until every day is a study day.
 */
export function getFullTimeNote({
  found,
  line,
  studiesEveryDay,
}: {
  found: PlanTimeToCover | null;
  line: TimeLine;
  studiesEveryDay: boolean;
}): FullTimeNote | null {
  if (!found || found.suggested?.kind !== "focus") {
    return null;
  }

  return line.kind === "everything"
    ? { kind: "tooLong" }
    : { kind: "takes", minutes: found.recommendedMinutes, moreDays: !studiesEveryDay };
}

export type TimeOffer = { kind: "everything" | "focus" | "full"; minutes: number };

/**
 * The suggestion while another time is shown, unless that time covers everything anyway; on a
 * focus suggestion, the time that covers everything.
 */
export function getOffer({
  found,
  line,
  minutes,
}: {
  found: PlanTimeToCover | null;
  line: TimeLine;
  minutes: number | null;
}): TimeOffer | null {
  const suggested = found?.suggested ?? null;

  if (!suggested) {
    return null;
  }

  if (suggested.minutes !== minutes) {
    const covered = suggested.kind === "everything" && line.kind === "everything";
    return covered ? null : { kind: suggested.kind, minutes: suggested.minutes };
  }

  const full = found?.recommendedMinutes ?? null;
  return suggested.kind === "focus" && full !== null ? { kind: "full", minutes: full } : null;
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
      : { coveredShare: suggested.coveredShare, everyTopic: suggested.everyTopic, kind: "focus" };
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
