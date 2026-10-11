import {
  type ClaimEvent,
  listAnsweredWrong,
  listClaimed,
  listKnownSkills,
  readSkillClaims,
} from "../../../learner/_utils/skill-claims";
import { toPassedOverClaims } from "../../_utils/passed-over-claims";
import { listFocusedSkillIds } from "../../planner/focus-targets";
import { listPassedOver } from "../../planner/graph-areas";
import { fromIsoDate } from "../../planner/plan-calendar";
import { type PlanSettings } from "../../planner/plan-state";
import { LEARN_KINDS, type SimWorld } from "./sim-world";

/**
 * The plan's part of what the learner model reads (`loadPlanEvents`): each test-out claims the
 * skill its item counts for (every skill its lesson teaches once that skill left the graph), each
 * finished lesson studies its skill and the skills its lesson teaches.
 */
function listPlanEvents(world: Pick<SimWorld, "inputs" | "pendingSkills" | "plan">): ClaimEvent[] {
  const { inputs, pendingSkills, plan } = world;
  const graphSkills = new Set(plan.state.graph.skills.map((skill) => skill.skillId));

  return plan.items.flatMap((item) => {
    if (
      !item.completedAt ||
      !LEARN_KINDS.has(item.kind) ||
      (item.status !== "done" && item.status !== "testedOut")
    ) {
      return [];
    }

    // A skill not outlined yet has no links to lessons.
    const taught = (item.lessonId ? (inputs.taughtBy.get(item.lessonId) ?? []) : []).filter(
      (skillId) => !pendingSkills.has(skillId),
    );

    const at = item.completedAt;
    const kind = item.status === "done" ? "studied" : "claim";

    const claimed =
      item.status === "testedOut" && item.skillId && graphSkills.has(item.skillId)
        ? [item.skillId]
        : [...new Set([...(item.skillId ? [item.skillId] : []), ...taught])];

    return claimed
      .filter((skillId) => graphSkills.has(skillId))
      .map((skillId): ClaimEvent => ({ at, kind, skillId }));
  });
}

const NOON_MS = 43_200_000;

/**
 * The test-outs the learner undid, from the moment of each (`loadUndoneTestOuts`): the day's noon,
 * when the simulator's placement tests out. The skills' earlier answers no longer show they know
 * them.
 */
function listUndoneEvents(world: Pick<SimWorld, "changes" | "inputs" | "plan">): ClaimEvent[] {
  const items = new Map(world.plan.items.map((item) => [item.id, item]));

  return world.changes.flatMap((change) =>
    change.kind === "testedOut" && change.status === "undone"
      ? (change.planItemIds ?? []).flatMap((itemId) => {
          const item = items.get(itemId);
          const taught = item?.lessonId ? (world.inputs.taughtBy.get(item.lessonId) ?? []) : [];
          const at = new Date(Date.parse(change.day) + NOON_MS);

          return [...new Set([...(item?.skillId ? [item.skillId] : []), ...taught])].map(
            (skillId): ClaimEvent => ({ at, kind: "undone", skillId }),
          );
        })
      : [],
  );
}

/**
 * The skills the learner passed over by choice (`loadPassedOverClaims`), each a claim from the
 * applied change that made the choice, or from the plan's first day for one made while setting it
 * up: before anything else that day, as the database tier makes the plan first.
 */
function listPassedOverEvents(world: Pick<SimWorld, "changes" | "inputs" | "plan">): ClaimEvent[] {
  const { graph, settings } = world.plan.state;

  if (settings.pastBasicsAreas.length === 0 && settings.baseChoices.length === 0) {
    return [];
  }

  return toPassedOverClaims({
    changes: world.changes
      .filter((change) => change.status === "applied")
      .map((change) => ({
        at: new Date(Date.parse(change.day) + NOON_MS),
        operations: change.operations,
      }))
      .toReversed(),
    createdAt: settings.startDate ? fromIsoDate(settings.startDate) : new Date(0),
    passed: listPassedOver({ graph, prerequisites: world.inputs.prerequisites, settings }),
  });
}

/**
 * Everything the learner model reads of the plan's skills (`loadClaimEvents`). The pure tier dates
 * a day's test-outs, their undo, the learner's changes and the lessons they finished at its noon,
 * so they're listed in the order a day's steps come, and claims read them in that order, as the
 * database tier's clock has them.
 */
function listSimClaimEvents(
  world: Pick<SimWorld, "changes" | "inputs" | "learner" | "pendingSkills" | "plan">,
): ClaimEvent[] {
  const planEvents = listPlanEvents(world);

  return [
    ...planEvents.filter((event) => event.kind !== "studied"),
    ...listUndoneEvents(world),
    ...listPassedOverEvents(world),
    ...planEvents.filter((event) => event.kind === "studied"),
    ...world.learner.testAnswers,
  ];
}

/**
 * The skills the learner model takes as gaps (`loadSkillClaims`), whose lessons an exam plan puts
 * first: from the plan's test-outs and finished lessons, the basics passed over by choice and
 * placement's answers.
 */
export function listGapSkillIds(
  world: Pick<SimWorld, "changes" | "inputs" | "learner" | "pendingSkills" | "plan">,
): Set<string> {
  return listClaimed({ claim: "gap", claims: readSkillClaims(listSimClaimEvents(world)) });
}

/**
 * The rest of what a planning run reads of the learner model (`loadSkillEvidence`): the skills an
 * answer missed and the ones the learner showed they know, two right answers of its own for a skill
 * of where they focus (`focus`: the plan's, or the one a change plans with).
 */
export function readSimEvidence(
  world: Pick<SimWorld, "changes" | "inputs" | "learner" | "pendingSkills" | "plan">,
  {
    focus = world.plan.state.settings,
  }: { focus?: Pick<PlanSettings, "focusAreas" | "focusParts"> } = {},
): { answeredWrongSkillIds: Set<string>; knownSkillIds: Set<string> } {
  const events = listSimClaimEvents(world);
  const focused = listFocusedSkillIds({ graph: world.plan.state.graph, settings: focus });

  return {
    answeredWrongSkillIds: listAnsweredWrong(events),
    knownSkillIds: listKnownSkills({ events, focused: (skillId) => focused.has(skillId) }),
  };
}

/** When placement's answer at `index` came: one moment apart, the last just before `at`. */
export function getPlacementAnswerTime({
  at,
  count,
  index,
}: {
  at: Date;
  count: number;
  index: number;
}): Date {
  return new Date(at.getTime() - (count - index));
}
