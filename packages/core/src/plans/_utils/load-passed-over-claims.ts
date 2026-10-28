import "server-only";
import { type Plan, prisma } from "@zoonk/db";
import { readSkillPrerequisiteMap } from "../../learner/_utils/plan-library-rows";
import { type ClaimEvent } from "../../learner/_utils/skill-claims";
import { listPassedOver } from "../planner/graph-areas";
import { parsePlanGraph, parsePlanSettings } from "../planner/plan-state";
import { toPassedOverClaims } from "./passed-over-claims";
import { parsePlanChangePayload } from "./plan-change-payload";

export async function loadPassedOverClaims({
  goalId,
  known,
  skillIds,
}: {
  goalId: string;
  known?: Pick<Plan, "createdAt" | "graph" | "id" | "settings"> | null;
  skillIds: ReadonlySet<string>;
}): Promise<ClaimEvent[]> {
  const plan =
    known === undefined
      ? await prisma.plan.findUnique({
          select: { createdAt: true, graph: true, id: true, settings: true },
          where: { goalId },
        })
      : known;

  const graph = parsePlanGraph(plan?.graph);
  const settings = parsePlanSettings(plan?.settings);

  if (!plan || (settings.pastBasicsAreas.length === 0 && settings.baseChoices.length === 0)) {
    return [];
  }

  const prerequisites = await readSkillPrerequisiteMap(
    graph.skills.map((skill) => skill.skillId),
    known === undefined ? prisma : "shared",
  );

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
