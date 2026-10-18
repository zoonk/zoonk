import { type PlanOperation } from "../../plan-contract";
import { type PlanChangeView } from "../../plan-view-contract";
import { addDays } from "../../planner/plan-calendar";
import { type PlanEffect } from "../../planner/plan-effect";
import {
  type PlanGraphSkill,
  type PlanPhase,
  type PlanSettings,
  parsePlanSettings,
} from "../../planner/plan-state";
import { type RuleContext, type RuleEvent, type RuleItem, type RulePlan } from "./rule-context";

/** A Monday, so weekday offsets in tests read as Monday plus N. */
const FIRST_DAY = new Date("2026-10-12T00:00:00.000Z");

/** The learner-local day `offset` days after the fixtures' first day. */
export function ruleDay(offset: number): Date {
  return addDays(FIRST_DAY, offset);
}

/** A graph skill: its area, its notice topics and its size. */
export function ruleSkill(skill: Partial<PlanGraphSkill> & { skillId: string }): PlanGraphSkill {
  return { area: "Area", lessons: 3, name: skill.skillId, phase: 0, weight: null, ...skill };
}

/**
 * A lesson item of a skill due `day` days after the first day: a written lesson unless `lessonId`
 * is null, which makes it a stand-in for the skill's lessons.
 */
export function ruleLesson({
  day,
  skillId,
  ...item
}: Partial<RuleItem> & { day: number | null; skillId: string }): RuleItem {
  return {
    chapterId: null,
    completedAt: null,
    kind: "lesson",
    lessonId: `${skillId}-${day ?? "none"}`,
    phase: 0,
    scheduledFor: day === null ? null : ruleDay(day),
    skillId,
    status: "todo",
    titleSnapshot: `${skillId} lesson`,
    ...item,
  };
}

/** A fixed event of the plan (a mock, a checkpoint, a review) on a day. */
export function ruleEventItem({
  day,
  kind,
  phase = 0,
}: {
  day: number;
  kind: Exclude<RuleItem["kind"], "chapter" | "lesson">;
  phase?: number;
}): RuleItem {
  return {
    chapterId: null,
    completedAt: null,
    kind,
    lessonId: null,
    phase,
    scheduledFor: ruleDay(day),
    skillId: null,
    status: "todo",
    titleSnapshot: kind,
  };
}

/** A phase from one fixture day to another. */
export function rulePhase({
  end,
  kind = "learn",
  start,
}: {
  end: number;
  kind?: PlanPhase["kind"];
  start: number;
}): PlanPhase {
  return {
    endDate: ruleDay(end).toISOString().slice(0, 10),
    kind,
    milestone: null,
    minutes: 0,
    name: kind,
    startDate: ruleDay(start).toISOString().slice(0, 10),
  };
}

/** A plan with these skills and items; a learn goal of 30 minutes a day without a date. */
export function rulePlan({
  goal,
  items = [],
  settings = {},
  skills,
  ...plan
}: Partial<Omit<RulePlan, "goal" | "graph" | "settings">> & {
  goal?: Partial<RulePlan["goal"]>;
  settings?: Partial<PlanSettings>;
  skills: readonly PlanGraphSkill[];
}): RulePlan {
  return {
    goal: { dailyMinutes: 30, kind: "learn", targetDate: null, ...goal },
    graph: { phases: [{ milestone: null, name: "Basics" }], skills: [...skills] },
    items,
    phases: [],
    settings: { ...parsePlanSettings({}), ...settings },
    ...plan,
  };
}

/** The learner made or applied a change with these operations. */
export function ruleChangeEvent(...operations: PlanOperation[]): RuleEvent {
  return { kind: "learnerChange", operations };
}

/** A step from `before` to `after` on the fixtures' first day. */
export function ruleContext({
  event = { kind: "refresh" },
  today = ruleDay(0),
  ...context
}: Partial<RuleContext> & { after: RulePlan; event?: RuleEvent }): RuleContext {
  return { before: null, event, today, ...context };
}

/** A change the learner applied, with its card's effect. */
export function ruleChange({
  effect,
  ...change
}: Omit<Partial<PlanChangeView>, "effect"> & { effect: Partial<PlanEffect> }): PlanChangeView {
  return {
    behind: null,
    canUndo: true,
    createdAt: ruleDay(0).toISOString(),
    days: null,
    effect: {
      endDateAfter: null,
      endDateBefore: null,
      lessonsAdded: 0,
      lessonsRemoved: 0,
      ...effect,
    },
    examDocument: "notice",
    id: "change",
    kind: "edited",
    lessonsSkipped: 0,
    officialDate: null,
    operations: [],
    reason: null,
    seen: false,
    source: "learner",
    status: "applied",
    todaySession: null,
    ...change,
  };
}

/**
 * Today's proposal to move the phase dates (`fitPhaseDates`), waiting for the learner or declined
 * ("Keep mine"), with what moving them does.
 */
export function rulePhaseDatesProposal({
  effect,
  status = "proposed",
}: {
  effect: Partial<PlanEffect>;
  status?: PlanChangeView["status"];
}): PlanChangeView {
  return ruleChange({
    effect,
    id: "phase-dates",
    operations: [{ kind: "fitPhaseDates" }],
    source: "phaseDates",
    status,
  });
}
