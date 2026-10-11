import { toTopicKey } from "../../../library/exams/topic-key";
import { type PlanOperation } from "../../plan-contract";
import { type PlanChangeView } from "../../plan-view-contract";
import { fromIsoDate } from "../../planner/plan-calendar";
import { type RuleContext, type RulePlan } from "./rule-context";
import { getAreaOf } from "./rule-items";

/** Whether a change's operation passes a skill over: skips it as a base, or its area's basics. */
function passesOver({
  area,
  operation,
  skillId,
}: {
  area: string;
  operation: PlanOperation;
  skillId: string;
}): boolean {
  if (operation.kind === "setBaseChoices") {
    return operation.choices.some((base) => base.skillId === skillId && base.choice === "skip");
  }

  return (
    operation.kind === "setAreaStart" &&
    operation.start === "pastBasics" &&
    operation.areas.includes(area)
  );
}

/**
 * The day the learner passed a skill over: their latest change that did, else the plan's first
 * day (a choice made while setting the plan up). Null without the learner's changes or a start.
 */
export function findChoiceDay({
  learnerChanges,
  plan,
  skillId,
}: {
  learnerChanges: NonNullable<RuleContext["learnerChanges"]>;
  plan: RulePlan;
  skillId: string;
}): Date | null {
  const area = getAreaOf(plan.graph)(skillId) ?? "";

  const chosen = learnerChanges.findLast((change) =>
    change.operations.some((operation) => passesOver({ area, operation, skillId })),
  );

  if (chosen) {
    return chosen.day;
  }

  return plan.settings.startDate ? fromIsoDate(plan.settings.startDate) : null;
}

/**
 * Whether one of the step's changes names a skill among the topics it brings into the plan: by
 * one of its notice topics, or by its own name when it has none (as `bringBackMissedLessons` does).
 */
export function isNamedBack({
  changes,
  plan,
  skillId,
}: {
  changes: readonly PlanChangeView[];
  plan: RulePlan;
  skillId: string;
}): boolean {
  const skill = plan.graph.skills.find((entry) => entry.skillId === skillId);

  const names = new Set(
    [...(skill?.topics ?? []), skill?.name ?? skillId].map((name) => toTopicKey(name)),
  );

  return changes.some((change) =>
    (change.effect?.topicsAdded ?? []).some((entry) =>
      entry.topics.some((topic) => names.has(toTopicKey(topic))),
    ),
  );
}
