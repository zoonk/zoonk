import { type GoalKind } from "@zoonk/db";
import { findAnnouncedSkillIds } from "../../planner/announced-lessons";
import { getSkillArea } from "../../planner/graph-areas";
import { fromIsoDate } from "../../planner/plan-calendar";
import {
  type RuleAnswer,
  type RuleContext,
  type RuleEvent,
  type RulePlan,
  type RuleViolation,
} from "../rules/rule-context";
import { type SimInputs } from "./sim-inputs";
import { type SimPlan } from "./sim-world";

/**
 * What the simulator calls each step, for reports: `open` is the day's first look at Today (a
 * `newDay` to the checks: later looks the same day change nothing), `refresh` a system re-plan
 * with nothing new, `session` a study session (with the re-plan a completed one runs), `land`
 * lessons the Library outlined landing.
 */
export type SimStepLabel =
  | "change"
  | "create"
  | "land"
  | "open"
  | "placement"
  | "refresh"
  | "session";

/** A violation, where it happened in the life, and what the simulator called the step. */
export type SimViolation = RuleViolation & { label: SimStepLabel; step: number; today: string };

/** What a step records about the learner for the checks: their answers and what they said. */
type SimLearnerFacts = {
  /** The skills a class test's material announces questions on (`findAnnouncedSkillIds`). */
  announcedSkillIds: string[];
  answers: RuleAnswer[];
  gapAreas: string[];
  knownAreas: string[];
  /** The skills the learner showed they know, as the planner reads them (`listKnownSkills`). */
  knownSkillIds: readonly string[];
};

function toRulePlan({
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
  event,
  inputs,
  kind,
  learner,
  today,
  todayShown,
}: {
  after: SimPlan;
  before: SimPlan | null;
  event: RuleEvent;
  inputs: Pick<SimInputs, "prerequisites" | "taughtBy" | "topicLevels">;
  kind: GoalKind;
  learner: SimLearnerFacts;
  today: Date;
  todayShown: boolean;
}): RuleContext {
  return {
    after: toRulePlan({ inputs, kind, plan: after }),
    answers: learner.answers,
    before: before ? toRulePlan({ inputs, kind, plan: before }) : null,
    event,
    learner: {
      announcedSkillIds: learner.announcedSkillIds,
      gapAreas: learner.gapAreas,
      knownAreas: learner.knownAreas,
      knownSkillIds: learner.knownSkillIds,
    },
    today,
    todayShown,
  };
}
