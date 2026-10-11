import "server-only";
import { prisma } from "@zoonk/db";
import { type ClaimEvent } from "../../learner/_utils/skill-claims";
import { loadSkillPrerequisites } from "../../library/skills/skill-prerequisites";
import { type PlanOperation } from "../plan-contract";
import { type PassedOver, listPassedOver } from "../planner/graph-areas";
import { parsePlanGraph, parsePlanSettings } from "../planner/plan-state";
import { parsePlanChangePayload } from "./plan-change-payload";

/** Whether an operation made the choice that passed a skill over. */
function makesChoice({ operation, passed }: { operation: PlanOperation; passed: PassedOver }) {
  if (operation.kind === "setBaseChoices") {
    return operation.choices.some(
      (entry) => entry.skillId === passed.skillId && entry.choice === "skip",
    );
  }

  return (
    operation.kind === "setAreaStart" &&
    operation.start === "pastBasics" &&
    operation.areas.includes(passed.area)
  );
}

/**
 * Each skill passed over by choice as a claim from the day of the choice: the latest applied change
 * that made it (`changes`, newest first), or the plan's first day (`createdAt`) for a choice made
 * while setting it up.
 *
 * @internal Exported for the simulator's pure tier; the apps go through `loadPassedOverClaims`.
 */
export function toPassedOverClaims({
  changes,
  createdAt,
  passed,
}: {
  changes: readonly { at: Date; operations: readonly PlanOperation[] }[];
  createdAt: Date;
  passed: readonly PassedOver[];
}): ClaimEvent[] {
  return passed.map((entry) => ({
    at:
      changes.find((change) =>
        change.operations.some((operation) => makesChoice({ operation, passed: entry })),
      )?.at ?? createdAt,
    kind: "claim",
    skillId: entry.skillId,
  }));
}

/**
 * The skills of a goal the learner passed over by choice (see `listPassedOver`) as claims to
 * confirm from the day of the choice: the applied change that made it, or the plan's first day
 * for a choice made while setting it up. Like a test-out, a choice frees a topic from its lessons,
 * never from practice: practice asks it within two weeks, and a miss brings its lessons back.
 */
export async function loadPassedOverClaims({
  goalId,
  skillIds,
}: {
  goalId: string;
  skillIds: ReadonlySet<string>;
}): Promise<ClaimEvent[]> {
  const plan = await prisma.plan.findUnique({
    select: { createdAt: true, graph: true, id: true, settings: true },
    where: { goalId },
  });

  const graph = parsePlanGraph(plan?.graph);
  const settings = parsePlanSettings(plan?.settings);

  if (!plan || (settings.pastBasicsAreas.length === 0 && settings.baseChoices.length === 0)) {
    return [];
  }

  const prerequisites = await loadSkillPrerequisites(graph.skills.map((skill) => skill.skillId));

  const passed = listPassedOver({ graph, prerequisites, settings }).filter((entry) =>
    skillIds.has(entry.skillId),
  );

  if (passed.length === 0) {
    return [];
  }

  const changes = await prisma.planChange.findMany({
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, payload: true },
    where: { planId: plan.id, status: "applied" },
  });

  return toPassedOverClaims({
    changes: changes.map((change) => ({
      at: change.createdAt,
      operations: parsePlanChangePayload(change.payload).operations,
    })),
    createdAt: plan.createdAt,
    passed,
  });
}
