import "server-only";
import { prisma } from "@zoonk/db";
import { parsePlanGraph } from "../../../plans/planner/plan-state";
import { pickPlacementItemSkillIds } from "../placement-item-picks";

/**
 * A plan whose run never recorded the end of placement's questions (a lost run, or a plan built
 * before the run recorded it) stops waiting for them this long after its graph was written.
 */
const QUESTION_WRITING_WINDOW_MS = 10 * 60 * 1000;

/** How the run building the goal's plan went, as placement needs it. */
type PlanBuild = {
  /** The run gave up before the plan had skills: nothing will come until it's started again. */
  failed: boolean;
  /** The skills whose placement questions are still being written: none once writing ended. */
  preparingSkillIds: Set<string>;
};

/** How the run building the goal's plan went, and which placement questions it still writes. */
export async function loadPlanBuild({
  everySkill,
  goalId,
  knownAreas,
}: {
  /** A test from the learner's own material, whose every skill gets questions. */
  everySkill: boolean;
  goalId: string;
  /** The subjects the learner knows well, whose basics placement writes no questions for. */
  knownAreas: readonly string[];
}): Promise<PlanBuild> {
  const plan = await prisma.plan.findUnique({
    select: {
      buildFailedAt: true,
      createdAt: true,
      generatedAt: true,
      graph: true,
      placementPreparedAt: true,
    },
    where: { goalId },
  });

  if (!plan) {
    return { failed: false, preparingSkillIds: new Set() };
  }

  const graphWrittenAt = plan.generatedAt ?? plan.createdAt;

  const writing =
    plan.placementPreparedAt === null &&
    Date.now() - graphWrittenAt.getTime() < QUESTION_WRITING_WINDOW_MS;

  return {
    failed: plan.buildFailedAt !== null,
    preparingSkillIds: new Set(
      writing
        ? pickPlacementItemSkillIds({ everySkill, graph: parsePlanGraph(plan.graph), knownAreas })
        : [],
    ),
  };
}
