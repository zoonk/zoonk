import { MS_PER_DAY } from "@zoonk/utils/date";
import { daysBetween, fromIsoDate } from "../../plans/planner/plan-calendar";
import { type PlanPhase } from "../../plans/planner/plan-state";

export const EXAM_STAGES = [
  "preparing",
  "finalStretch",
  "dayBefore",
  "examDay",
  "afterExam",
] as const;

export type ExamStage = (typeof EXAM_STAGES)[number];

const EXAM_DAY_CHECKLIST = ["documents", "blackPen", "route", "examTime", "sleep"] as const;

export const EXAM_DAY_CHECKLIST_KEYS = [...EXAM_DAY_CHECKLIST, "materials"] as const;

export type ExamDayChecklistKey = (typeof EXAM_DAY_CHECKLIST_KEYS)[number];

const CLASS_TEST_CHECKLIST: readonly ExamDayChecklistKey[] = ["materials", "sleep"];

export function getExamDayChecklist(
  blueprint: { ownerId: string | null } | null,
): ExamDayChecklistKey[] {
  if (!blueprint) {
    return [];
  }

  return blueprint.ownerId ? [...CLASS_TEST_CHECKLIST] : [...EXAM_DAY_CHECKLIST];
}

export function getDaysToExam({
  targetDate,
  today,
}: {
  targetDate: Date | null;
  today: Date;
}): number | null {
  return targetDate ? daysBetween(today, targetDate) : null;
}

export function getFinalStretchStart(phases: readonly PlanPhase[]): Date | null {
  const start = phases.find((phase) => phase.kind === "finalStretch")?.startDate;
  return start ? fromIsoDate(start) : null;
}

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

export function getExamStage({
  examDays,
  finalStretchStart = null,
  today,
}: {
  examDays: readonly Date[];
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
