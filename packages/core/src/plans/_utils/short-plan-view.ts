import { type Goal } from "@zoonk/db";
import { type PlanView, type ShortExamFocus, type ShortPhaseView } from "../plan-view-contract";
import { daysBetween, fromIsoDate, toIsoDate } from "../planner/plan-calendar";
import { type ExistingPlanItem } from "../planner/plan-items";
import { type PlanPhase, type PlanSettings } from "../planner/plan-state";
import {
  type ShortExamPhaseKind,
  getShortExamFocus,
  isShortExam,
} from "../planner/short-exam-plan";

export type ShortPlanShape = { days: number; planStart: Date; shortMockMinutes: number | null };

export type ShortPlanDay = { day: number; days: number; focus: ShortExamFocus };

const SHORT_PHASE_KINDS = new Set<PlanPhase["kind"]>(["finalStretch", "gaps", "practice"]);

function isShortPhaseKind(kind: PlanPhase["kind"]): kind is ShortExamPhaseKind {
  return SHORT_PHASE_KINDS.has(kind);
}

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

type ShortPlanToday = { phases: readonly PlanPhase[]; shape: ShortPlanShape | null; today: Date };

function findToday({ phases, shape, today }: ShortPlanToday) {
  if (!shape) {
    return null;
  }

  const day = daysBetween(shape.planStart, today) + 1;
  const views = phases.map((phase) => toShortPhaseView({ phase, shape }));

  const index = views.findIndex(
    (view) => view !== null && view.firstDay <= day && day <= view.lastDay,
  );

  const view = views[index];

  return view ? { day, days: shape.days, focus: view.focus, index } : null;
}

export function getShortPlanDay(input: ShortPlanToday): ShortPlanDay | null {
  const found = findToday(input);
  return found ? { day: found.day, days: found.days, focus: found.focus } : null;
}

export function findShortPlanPhase({
  progressPhase,
  ...input
}: ShortPlanToday & { progressPhase: number | null }): number | null {
  const todayPhase = findToday(input)?.index ?? null;

  if (todayPhase === null || progressPhase === null) {
    return todayPhase ?? progressPhase;
  }

  return Math.min(todayPhase, progressPhase);
}

export function toShortPlanView({
  items,
  shape,
}: {
  items: readonly Pick<ExistingPlanItem, "kind" | "scheduledFor">[];
  shape: ShortPlanShape | null;
}): PlanView["shortPlan"] {
  if (!shape) {
    return null;
  }

  const mock = items.find((item) => item.kind === "mock" && item.scheduledFor);

  return { days: shape.days, mockDate: mock?.scheduledFor ? toIsoDate(mock.scheduledFor) : null };
}
