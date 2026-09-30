import { MS_PER_DAY } from "@zoonk/utils/date";
import { daysBetween, fromIsoDate } from "../../plans/planner/plan-calendar";
import { type PlanPhase } from "../../plans/planner/plan-state";

/**
 * Where the learner stands against the exam: preparing, in the final stretch, the light day
 * before, on an exam day, or after it, when "How did it go?" asks for the official result.
 */
export const EXAM_STAGES = [
  "preparing",
  "finalStretch",
  "dayBefore",
  "examDay",
  "afterExam",
] as const;

export type ExamStage = (typeof EXAM_STAGES)[number];

/** Rehearsing the real exam day, the day before it: keys the apps translate and tick off. */
const EXAM_DAY_CHECKLIST = ["documents", "blackPen", "route", "examTime", "sleep"] as const;

/** Every checklist key: a class test at school has its own short list. */
export const EXAM_DAY_CHECKLIST_KEYS = [...EXAM_DAY_CHECKLIST, "materials"] as const;

export type ExamDayChecklistKey = (typeof EXAM_DAY_CHECKLIST_KEYS)[number];

/**
 * A class test (a private blueprint read from the learner's own material) has no ID check, gates
 * or answer-sheet pen: what the teacher allows on the desk, and sleep.
 */
const CLASS_TEST_CHECKLIST: readonly ExamDayChecklistKey[] = ["materials", "sleep"];

/** What to have ready on the exam day: a public exam's list, or a class test's short one. */
export function getExamDayChecklist(
  blueprint: { ownerId: string | null } | null,
): ExamDayChecklistKey[] {
  return blueprint?.ownerId ? [...CLASS_TEST_CHECKLIST] : [...EXAM_DAY_CHECKLIST];
}

/** Days until the exam, as learner-local dates; null without a date. */
export function getDaysToExam({
  targetDate,
  today,
}: {
  targetDate: Date | null;
  today: Date;
}): number | null {
  return targetDate ? daysBetween(today, targetDate) : null;
}

/**
 * The day the final stretch starts: the first day of the plan's final-stretch phase, which the
 * planner sizes (the last two weeks, or a share of a shorter plan) and fills with review and
 * full-length mocks instead of new topics. Plan, Today, the mocks and the reviews all read it, so
 * they agree on when it starts. Null without one: no exam date, or a plan too short to have it.
 */
export function getFinalStretchStart(phases: readonly PlanPhase[]): Date | null {
  const start = phases.find((phase) => phase.kind === "finalStretch")?.startDate;
  return start ? fromIsoDate(start) : null;
}

/** From the final stretch's first day up to the exam day. */
export function isInFinalStretch({
  finalStretchStart,
  targetDate,
  today,
}: {
  finalStretchStart: Date | null;
  targetDate: Date | null;
  today: Date;
}): boolean {
  return (
    finalStretchStart !== null &&
    targetDate !== null &&
    finalStretchStart <= today &&
    today <= targetDate
  );
}

/**
 * The learner's stage for an exam taken on one or more days (ENEM runs on two Sundays). The day
 * before the first day is light; after the last day, the exam is behind them.
 */
export function getExamStage({
  examDays,
  finalStretchStart = null,
  today,
}: {
  /** The exam's days as UTC-midnight labels, in any order; empty without a date. */
  examDays: readonly Date[];
  /** See `getFinalStretchStart`; a short plan's is its day before, so it's all learning till then. */
  finalStretchStart?: Date | null;
  today: Date;
}): ExamStage {
  const days = examDays.map((day) => day.getTime()).toSorted((a, b) => a - b);
  const first = days[0];
  const last = days.at(-1);

  if (first === undefined || last === undefined) {
    return "preparing";
  }

  const now = today.getTime();

  if (now > last) {
    return "afterExam";
  }

  if (days.includes(now)) {
    return "examDay";
  }

  const untilFirst = Math.round((first - now) / MS_PER_DAY);

  if (untilFirst === 1) {
    return "dayBefore";
  }

  return finalStretchStart !== null && finalStretchStart.getTime() <= now
    ? "finalStretch"
    : "preparing";
}
