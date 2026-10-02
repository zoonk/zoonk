import { type Goal } from "@zoonk/db";
import { type ShortExamFocus, type ShortPhaseView } from "../plan-view-contract";
import { daysBetween, fromIsoDate } from "../planner/plan-calendar";
import { type PlanPhase, type PlanSettings } from "../planner/plan-state";
import {
  type ShortExamPhaseKind,
  getShortExamFocus,
  isShortExam,
} from "../planner/short-exam-plan";

/** A short plan's first day, its study days and a class test's short mock, from its settings. */
export type ShortPlanShape = { days: number; planStart: Date; shortMockMinutes: number | null };

/** Today in a short plan: "Day 1 of 3: map and gaps". */
export type ShortPlanDay = { day: number; days: number; focus: ShortExamFocus };

const SHORT_PHASE_KINDS = new Set<PlanPhase["kind"]>(["finalStretch", "gaps", "practice"]);

function isShortPhaseKind(kind: PlanPhase["kind"]): kind is ShortExamPhaseKind {
  return SHORT_PHASE_KINDS.has(kind);
}

/**
 * The shape of an exam plan days away, from the same rule the planner splits its days by; null
 * for any other plan.
 */
export function getShortPlanShape({
  goal,
  settings,
}: {
  goal: Pick<Goal, "kind" | "targetDate">;
  settings: Pick<PlanSettings, "shortMockMinutes" | "startDate">;
}): ShortPlanShape | null {
  if (goal.kind !== "exam" || !goal.targetDate || !settings.startDate) {
    return null;
  }

  const planStart = fromIsoDate(settings.startDate);

  if (!isShortExam({ planStart, targetDate: goal.targetDate })) {
    return null;
  }

  return {
    days: daysBetween(planStart, goal.targetDate),
    planStart,
    shortMockMinutes: settings.shortMockMinutes,
  };
}

/** The days a phase of a short plan covers, counted from its first day, and what they're for. */
export function toShortPhaseView({
  phase,
  shape,
}: {
  phase: Pick<PlanPhase, "endDate" | "kind" | "startDate">;
  shape: ShortPlanShape | null;
}): ShortPhaseView | null {
  if (!shape || !phase.startDate || !phase.endDate || !isShortPhaseKind(phase.kind)) {
    return null;
  }

  return {
    firstDay: daysBetween(shape.planStart, fromIsoDate(phase.startDate)) + 1,
    focus: getShortExamFocus({ kind: phase.kind, shortMockMinutes: shape.shortMockMinutes }),
    lastDay: daysBetween(shape.planStart, fromIsoDate(phase.endDate)) + 1,
  };
}

/** Which day of a short plan today is and what it's for; null outside its days. */
export function getShortPlanDay({
  phases,
  shape,
  today,
}: {
  phases: readonly PlanPhase[];
  shape: ShortPlanShape | null;
  today: Date;
}): ShortPlanDay | null {
  if (!shape) {
    return null;
  }

  const day = daysBetween(shape.planStart, today) + 1;

  const short = phases
    .map((phase) => toShortPhaseView({ phase, shape }))
    .find((view) => view !== null && view.firstDay <= day && day <= view.lastDay);

  return short ? { day, days: shape.days, focus: short.focus } : null;
}
