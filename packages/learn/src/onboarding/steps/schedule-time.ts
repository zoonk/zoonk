import {
  type PlanTimeAdviceInput,
  type PlanTimeToCover,
} from "@zoonk/core/plans/time-advice-contract";
import { type TimeLine, getSuggestedMinutes, isBusyLine } from "../../_utils/time-answer";

export type StudyWeek = Omit<PlanTimeAdviceInput, "dailyMinutes"> & { studyDays: number[] };

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

type Answer = { found: PlanTimeToCover | null; line: TimeLine };

/** While the time shown is worked out again, the last answer stays in place, marked as updating. */
export function getShownAnswer({
  last,
  now,
}: {
  last: Answer;
  now: Answer;
}): Answer & { updating: boolean } {
  const updating = isBusyLine(now.line) && !isBusyLine(last.line);
  return { ...(updating ? last : now), updating };
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
