import { type GoalKind } from "@zoonk/db";
import { type PlanOperation } from "../../plan-contract";
import { type ExistingPlanItem } from "../../planner/plan-items";
import { type PlanGraph, type PlanPhase, type PlanSettings } from "../../planner/plan-state";

/**
 * A plan item as a check reads it: the planner's own fields, so a planning run's items
 * (`BuiltPlan.items`) and saved rows both fit. `lessons` is a stand-in's size as saved (see
 * `countItemLessons`); without it a stand-in counts as one lesson. `minutes` is what a planning
 * run gave it, when the step has it.
 */
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

/**
 * A plan at one moment, as saved: what the planner read to make it and the items it laid out, in
 * the plan's order. Dates are learner-local days at UTC midnight, as the planner uses them.
 */
export type RulePlan = {
  goal: { dailyMinutes: number; kind: GoalKind; targetDate: Date | null };
  graph: PlanGraph;
  items: readonly RuleItem[];
  phases: readonly PlanPhase[];
  /** Each skill's hard prerequisites, as the planner read them. */
  prerequisites?: ReadonlyMap<string, readonly string[]>;
  settings: PlanSettings;
  /**
   * The skills each lesson teaches, by lesson id (the Library's lesson links): a finished lesson
   * counted for one skill began every skill it teaches.
   */
  taughtBy?: ReadonlyMap<string, readonly string[]>;
};

/**
 * What happened in a step. `learnerChange` is a learner's action (they made or applied a change);
 * `newDay` is progress (a missed day counts: it moves dates); `refresh` is the system's own run,
 * which may not change what the learner sees on its own.
 */
export type RuleEvent =
  | { kind: "learnerChange"; operations: readonly PlanOperation[] }
  /** A new day settled what earlier days left. */
  | { kind: "newDay" }
  | { kind: "planCreated" }
  /** The app opened again the same day. */
  | { kind: "refresh" };

/** What the learner showed they know or said about their knowledge. */
type RuleLearner = {
  /** Areas placement found gaps in, or the learner said they don't know yet. */
  gapAreas?: readonly string[];
  /** Areas the learner said they know (onboarding's known subjects). */
  knownAreas?: readonly string[];
};

/**
 * One step of a learner's life as the checks read it: the plan before and after it and what
 * happened. Every part but `after`, `event` and `today` is optional: a check whose inputs are
 * missing finds nothing.
 */
export type RuleContext = {
  after: RulePlan;
  before: RulePlan | null;
  event: RuleEvent;
  learner?: RuleLearner;
  /** The learner-local day of the step, at UTC midnight. */
  today: Date;
  /** Today's session was built before the step, so the learner saw today's lessons. */
  todayShown?: boolean;
};

/** A rule a step broke: which one, and what the check saw. */
export type RuleViolation = { details?: Record<string, unknown>; message: string; rule: string };
