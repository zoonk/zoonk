import { type Goal, type GoalKind } from "@zoonk/db";
import { getExamDocument } from "../../../exams/exam-document";
import { type PlanChangeView } from "../../plan-view-contract";
import { findAnnouncedSkillIds } from "../../planner/announced-lessons";
import { getSkillArea } from "../../planner/graph-areas";
import { fromIsoDate } from "../../planner/plan-calendar";
import {
  type RuleAnswer,
  type RuleContext,
  type RuleEvent,
  type RulePlan,
  type RuleSyllabus,
  type RuleView,
  type RuleViolation,
} from "../rules/rule-context";
import { type SimInputs } from "./sim-inputs";
import { type SimChange, type SimPlan } from "./sim-world";

/**
 * What the simulator calls each step, for reports: `open` is the day's first look at Today (a
 * `newDay` to the checks: later looks the same day change nothing), `refresh` a system re-plan
 * with nothing new, `session` a study session (with the re-plan a completed one runs), `land`
 * lessons the Library wrote landing, `answer` the learner applying Today's proposal or a finished
 * mock's offer, `mock` the session up to a finished mock whose offer the learner then answers,
 * `undo` the learner taking back the change or test-outs just made.
 */
export type SimStepLabel =
  | "answer"
  | "change"
  | "create"
  | "land"
  | "mock"
  | "open"
  | "placement"
  | "refresh"
  | "session"
  | "testOut"
  | "undo";

/**
 * The changes a learner made or applied so far, on their day: the applied ones with operations
 * that the system didn't make on its own.
 */
export function listLearnerChanges(changes: readonly SimChange[]) {
  return changes.flatMap((change) =>
    change.status === "applied" && change.source !== "system" && change.operations.length > 0
      ? [{ day: fromIsoDate(change.day), operations: change.operations }]
      : [],
  );
}

/** A violation, where it happened in the life, and what the simulator called the step. */
export type SimViolation = RuleViolation & { label: SimStepLabel; step: number; today: string };

/** What a step records about the learner for the checks: their answers and what they said. */
export type SimLearnerFacts = {
  /** The skills a class test's material announces questions on (`findAnnouncedSkillIds`). */
  announcedSkillIds: string[];
  answers: RuleAnswer[];
  gapAreas: string[];
  knownAreas: string[];
  /** The skills the learner showed they know, as the planner reads them (`listKnownSkills`). */
  knownSkillIds: readonly string[];
  /** The skills the exam practices only with its recordings (`getListeningSkillIds`). */
  listeningSkillIds: readonly string[];
  plus: boolean;
};

export function toRulePlan({
  inputs,
  kind,
  plan,
}: {
  inputs: Pick<SimInputs, "prerequisites" | "taughtBy" | "topicLevels">;
  kind: GoalKind;
  plan: SimPlan;
}): RulePlan {
  return {
    goal: {
      dailyMinutes: plan.state.goal.dailyMinutes,
      kind,
      targetDate: plan.state.goal.targetDate ? fromIsoDate(plan.state.goal.targetDate) : null,
    },
    graph: plan.state.graph,
    items: plan.items,
    phases: plan.phases,
    prerequisites: inputs.prerequisites,
    settings: plan.state.settings,
    taughtBy: inputs.taughtBy,
    topicLevels: inputs.topicLevels,
  };
}

/** A change the pure tier recorded, as clients read it (the database tier reads the real view). */
export function toSimChangeView({
  change,
  goal,
  index,
}: {
  change: SimChange;
  goal: Pick<Goal, "kind" | "targetLanguage">;
  index: number;
}): PlanChangeView {
  return {
    behind: change.behind ?? null,
    canUndo: false,
    createdAt: `${change.day}T12:00:00.000Z`,
    days: null,
    effect: change.effect,
    examDocument: getExamDocument(goal),
    id: `sim-change-${index}`,
    kind: change.kind,
    lessonsSkipped: 0,
    officialDate: null,
    operations: change.operations,
    reason: null,
    seen: false,
    source: change.source,
    status: change.status,
    todaySession: null,
  };
}

/** The skills a class test's announced questions ask about, as the planner reads them. */
export function listAnnouncedSkillIds({
  announcements,
  graph,
}: {
  announcements: readonly string[];
  graph: SimPlan["state"]["graph"];
}): string[] {
  return [...findAnnouncedSkillIds({ announcements, skills: graph.skills })];
}

/** The areas a learner's missed skills belong to: what they don't know yet. */
export function listGapAreas({
  graph,
  skillIds,
}: {
  graph: SimPlan["state"]["graph"];
  skillIds: Iterable<string>;
}): string[] {
  const ids = new Set(skillIds);

  return [
    ...new Set(
      graph.skills.flatMap((skill) =>
        ids.has(skill.skillId) ? [getSkillArea({ graph, skill })] : [],
      ),
    ),
  ];
}

/** One step as the owner rules' checks read it (see `plans/_test-utils/rules`). */
export function toRuleContext({
  after,
  before,
  changes,
  declined,
  event,
  finishedLessons,
  inputs,
  kind,
  learner,
  learnerChanges,
  preparation,
  sessions,
  syllabus,
  today,
  todayShown,
  view,
  waiting,
}: {
  after: SimPlan;
  before: SimPlan | null;
  changes: readonly PlanChangeView[];
  /** The proposals the learner declined so far, as clients read them. */
  declined: readonly PlanChangeView[];
  event: RuleEvent;
  /** Every lesson the learner finished so far (the database tier, with questions). */
  finishedLessons?: RuleContext["finishedLessons"];
  inputs: Pick<SimInputs, "prerequisites" | "taughtBy" | "topicLevels">;
  kind: GoalKind;
  learner: SimLearnerFacts;
  learnerChanges: ReturnType<typeof listLearnerChanges>;
  /** The goal's preparation as clients read it after the step (the database tier, with questions). */
  preparation?: RuleContext["preparation"];
  /** Every study session so far and what its questions asked (the database tier, with questions). */
  sessions?: RuleContext["sessions"];
  /** The goal's syllabus as clients read it after the step (the database tier). */
  syllabus?: RuleSyllabus;
  today: Date;
  todayShown: boolean;
  /** The plan as clients read it after the step (the database tier). */
  view?: RuleView;
  /** The proposals still waiting for the learner's answer after the step, as clients read them. */
  waiting: readonly PlanChangeView[];
}): RuleContext {
  return {
    after: toRulePlan({ inputs, kind, plan: after }),
    answers: learner.answers,
    before: before ? toRulePlan({ inputs, kind, plan: before }) : null,
    changes,
    declined,
    event,
    finishedLessons,
    learner: {
      announcedSkillIds: learner.announcedSkillIds,
      gapAreas: learner.gapAreas,
      knownAreas: learner.knownAreas,
      knownSkillIds: learner.knownSkillIds,
      listeningSkillIds: learner.listeningSkillIds,
      plus: learner.plus,
    },
    learnerChanges,
    preparation,
    sessions,
    syllabus,
    today,
    todayShown,
    view,
    waiting,
  };
}
