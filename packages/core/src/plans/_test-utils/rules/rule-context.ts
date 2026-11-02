import { type GoalKind } from "@zoonk/db";
import { type PlanOperation } from "../../plan-contract";
import { type ExistingPlanItem } from "../../planner/plan-items";
import { type PlanGraph, type PlanPhase, type PlanSettings } from "../../planner/plan-state";

export type RuleItem = Pick<
  ExistingPlanItem,
  | "chapterId"
  | "completedAt"
  | "kind"
  | "lessonId"
  | "lessons"
  | "phase"
  | "scheduledFor"
  | "skillId"
  | "status"
  | "titleSnapshot"
> & { minutes?: number };

export type RulePlan = {
  goal: { dailyMinutes: number; kind: GoalKind; targetDate: Date | null };
  graph: PlanGraph;
  items: readonly RuleItem[];
  phases: readonly PlanPhase[];
  prerequisites?: ReadonlyMap<string, readonly string[]>;
  settings: PlanSettings;
  taughtBy?: ReadonlyMap<string, readonly string[]>;
};

export type RuleEvent =
  | { kind: "learnerChange"; operations: readonly PlanOperation[] }
  | { kind: "newDay" }
  | { kind: "planCreated" }
  | { kind: "refresh" };

type RuleLearner = { gapAreas?: readonly string[]; knownAreas?: readonly string[] };

export type RuleContext = {
  after: RulePlan;
  before: RulePlan | null;
  event: RuleEvent;
  learner?: RuleLearner;
  today: Date;
  todayShown?: boolean;
};

export type RuleViolation = { details?: Record<string, unknown>; message: string; rule: string };
