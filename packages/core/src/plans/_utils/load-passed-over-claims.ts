import "server-only";
import { type Plan, prisma } from "@zoonk/db";
import { type ClaimEvent } from "../../learner/_utils/skill-claims";
import { loadSkillPrerequisites } from "../../library/skills/skill-prerequisites";
import { listPassedOver } from "../planner/graph-areas";
import { parsePlanGraph, parsePlanSettings } from "../planner/plan-state";
import { toPassedOverClaims } from "./passed-over-claims";
import { parsePlanChangePayload } from "./plan-change-payload";

/**
 * The skills of a goal the learner passed over by choice (see `listPassedOver`) as claims to
 * confirm from the day of the choice: the applied change that made it, or the plan's first day
 * for a choice made while setting it up. Like a test-out, a choice frees a topic from its lessons,
 * never from practice: practice asks it within two weeks, and a miss brings its lessons back.
 */
export async function loadPassedOverClaims({
  goalId,
  known,
  skillIds,
}: {
  goalId: string;
  /** The saved plan a GET already read, so it isn't read again. */
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
