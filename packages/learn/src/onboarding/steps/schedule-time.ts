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
  minutes,
  weekend,
}: {
  days: number[];
  minutes: number;
  weekend: number | null;
}): StudyWeek {
  return weekend === null || weekend === minutes
    ? { studyDays: days }
    : { studyDays: days, weekendMinutes: weekend };
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

/** Continue saves only a time the learner picked, or one the screen has said what it means. */
export function waitsToSave({ line, picked }: { line: TimeLine; picked: number | null }): boolean {
  return picked === null && isBusyLine(line);
}

/** While the line is worked out again, the last one stays in place, marked as updating. */
export function getShownLine({ last, now }: { last: TimeLine; now: TimeLine }): {
  line: TimeLine;
  updating: boolean;
} {
  const updating = isBusyLine(now) && !isBusyLine(last);
  return { line: updating ? last : now, updating };
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

/** Only an undated goal's line depends on the time picked: when it would finish. */
export function asksAboutTime({ dated, minutes }: { dated: boolean; minutes: number | null }) {
  return minutes !== null && !dated;
}
