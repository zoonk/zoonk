import { type PlanOperation } from "../../plan-contract";
import { addDays } from "../../planner/plan-calendar";
import {
  type PlanGraphSkill,
  type PlanPhase,
  type PlanSettings,
  parsePlanSettings,
} from "../../planner/plan-state";
import { type RuleContext, type RuleEvent, type RuleItem, type RulePlan } from "./rule-context";

/** A Monday, so weekday offsets in tests read as Monday plus N. */
const FIRST_DAY = new Date("2026-10-12T00:00:00.000Z");

export function ruleDay(offset: number): Date {
  return addDays(FIRST_DAY, offset);
}

export function ruleSkill(skill: Partial<PlanGraphSkill> & { skillId: string }): PlanGraphSkill {
  return { area: "Area", lessons: 3, name: skill.skillId, phase: 0, weight: null, ...skill };
}

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

export function ruleChangeEvent(...operations: PlanOperation[]): RuleEvent {
  return { kind: "learnerChange", operations };
}

export function ruleContext({
  event = { kind: "refresh" },
  today = ruleDay(0),
  ...context
}: Partial<RuleContext> & { after: RulePlan; event?: RuleEvent }): RuleContext {
  return { before: null, event, today, ...context };
}
