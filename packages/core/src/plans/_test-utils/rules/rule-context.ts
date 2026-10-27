import { type GoalKind } from "@zoonk/db";
import { type TopicLevel } from "../../../library/exams/topic-frequency";
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
  /** How often the exam asks its notice's topics, for an exam with that data. */
  topicLevels?: readonly TopicLevel[];
};

/**
 * One answer the learner gave. True/false items say less than others (a guess is right half the
 * time), so they need more right answers to count a skill as known.
 */
export type RuleAnswer = {
  at: Date;
  correct: boolean;
  format: "other" | "trueFalse";
  skillId: string;
  source: "lesson" | "mock" | "placement" | "practice" | "review" | "testOut";
};

/**
 * What happened in a step. `learnerChange` is a learner's action (they made or applied a change);
 * `undo` takes back an applied change. `placement`, `session` and `newDay` are progress (a missed
 * day counts: it moves dates); `outlinesLanded` and `refresh` are the system's own runs, which may
 * not change what the learner sees on their own.
 */
export type RuleEvent =
  | {
      kind: "learnerChange";
      operations: readonly PlanOperation[];
      /**
       * The editor took the change as the Undo of the learner's latest edit: it set back by hand
       * what that edit changed (`undoSetBack`), so the plan goes back as it was before that edit.
       */
      setBack?: boolean;
    }
  /** A new day settled what earlier days left. */
  | { kind: "newDay" }
  | { kind: "outlinesLanded" }
  | { kind: "placement" }
  | { kind: "planCreated" }
  /** The app opened again the same day. */
  | { kind: "refresh" }
  | { kind: "session" }
  | { kind: "undo" };

/** What the learner showed they know or said about their knowledge. */
type RuleLearner = {
  /** Skills a class test's own material announces questions on. */
  announcedSkillIds?: readonly string[];
  /** Areas placement found gaps in, or the learner said they don't know yet. */
  gapAreas?: readonly string[];
  /** Areas the learner said they know (onboarding's known subjects). */
  knownAreas?: readonly string[];
  /**
   * Skills the learner showed they know, as the planner read them when it last built the plan
   * (`loadPlannerInputs`' `knownSkillIds`, the claim model's `listKnownSkills`). R11 judges a plan
   * by what it was built with: a skill a step's answers make known after that run counts from the
   * next build. A skill whose test-out the learner undid isn't known until a
   * later answer of its own.
   */
  knownSkillIds?: readonly string[];
};

/**
 * One step of a learner's life as the checks read it: the plan before and after it, what happened,
 * the changes it recorded. Every part but `after`, `event` and
 * `today` is optional: a check whose inputs are missing finds nothing.
 */
export type RuleContext = {
  after: RulePlan;
  /** Every answer the learner gave so far, oldest first. */
  answers?: readonly RuleAnswer[];
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
