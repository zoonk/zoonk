import "server-only";
import { isDeepStrictEqual } from "node:util";
import { prisma } from "@zoonk/db";
import { loadSkillSurvivors } from "../learner/_utils/update-learner-skill";
import { toExamOutline } from "../library/curriculum/exam-curriculum-outline";
import { prunePlanNoticeGraph } from "../library/curriculum/prune-plan-notice-graph";
import { commitPlan } from "./_utils/commit-plan";
import { followPlanToday } from "./_utils/follow-plan-today";
import { parsePlanChangePayload, toPlanChangePayload } from "./_utils/plan-change-payload";
import { type PlanContext } from "./_utils/plan-context";
import { loadPlanAtToken } from "./_utils/plan-token";
import { isPlanUnchanged } from "./_utils/plan-unchanged";
import { computePlan } from "./_utils/replan";
import { NOTICE_SOURCE } from "./plan-change-contract";
import { PlanConflictError, withPlanRetry } from "./plan-conflict";
import { followNoticeGraph } from "./planner/follow-notice-graph";
import { joinOptionSkills } from "./planner/option-skills";
import { type PlanGraph } from "./planner/plan-state";

async function loadPlanAdditions(context: PlanContext): Promise<Set<string>> {
  const changes = await prisma.planChange.findMany({
    select: { payload: true },
    where: {
      payload: { array_contains: [{ kind: "addSkills" }], path: ["operations"] },
      planId: context.plan.id,
      status: "applied",
    },
  });

  const ids = changes.flatMap((change) =>
    parsePlanChangePayload(change.payload).operations.flatMap((operation) =>
      operation.kind === "addSkills" ? operation.skills.map((skill) => skill.skillId) : [],
    ),
  );

  const survivorOf = await loadSkillSurvivors(ids);
  return new Set([...ids, ...ids.map((id) => survivorOf(id))]);
}

function describeDropped({
  current,
  dropped,
  graph,
}: {
  current: PlanGraph;
  dropped: ReadonlySet<string>;
  graph: PlanGraph;
}): string[] {
  const remaining = new Set(joinOptionSkills(graph).skills.map((skill) => skill.area));

  return [
    ...new Set(
      joinOptionSkills(current).skills.flatMap((skill) =>
        !skill.extra && dropped.has(skill.skillId)
          ? [skill.area && !remaining.has(skill.area) ? skill.area : skill.name]
          : [],
      ),
    ),
  ];
}

async function settleNoticeGraph({
  blueprintId,
  droppedSkillIds = [],
  goalId,
  graph,
}: {
  blueprintId: string;
  droppedSkillIds?: readonly string[];
  goalId: string;
  graph?: PlanGraph;
}): Promise<boolean> {
  const context = await loadPlanAtToken(goalId);

  if (
    !context ||
    context.goal.examBlueprintId !== blueprintId ||
    context.goal.kind !== "exam" ||
    context.goal.status !== "active" ||
    context.state.graph.skills.length === 0
  ) {
    return false;
  }

  const [blueprint, protectedIds] = await Promise.all([
    prisma.examBlueprint.findUnique({ where: { id: blueprintId } }),
    loadPlanAdditions(context),
  ]);

  if (!blueprint) {
    return false;
  }

  const current = context.state.graph;

  const checked = await prunePlanNoticeGraph({
    graph: graph ?? current,
    protectedIds,
    subjects: toExamOutline(blueprint).subjects,
  });

  const dropped = new Set(
    [...checked.dropped, ...droppedSkillIds].filter((id) => !protectedIds.has(id)),
  );

  if (!graph && dropped.size === 0) {
    return false;
  }

  const state = graph
    ? followNoticeGraph({ droppedIds: dropped, graph: checked.graph, state: context.state })
    : { ...context.state, graph: checked.graph };

  const computed = await computePlan({ context, mode: "forced", state });

  if (isPlanUnchanged({ computed, context })) {
    return false;
  }

  const noticeRemoved = describeDropped({ current, dropped, graph: computed.state.graph });

  const changeId = await commitPlan({
    change:
      noticeRemoved.length > 0
        ? {
            kind: "noticeChanged",
            payload: toPlanChangePayload({
              effect: { ...computed.effect, noticeRemoved },
              operations: [{ kind: "followNotice" }],
              source: NOTICE_SOURCE,
            }),
            reason: "",
            status: "applied",
          }
        : null,
    computed,
    context,
    extraWrites: async (tx) => {
      const latest = await tx.examBlueprint.findUnique({
        select: { structure: true },
        where: { id: blueprintId },
      });

      if (!isDeepStrictEqual(blueprint.structure, latest?.structure)) {
        throw new PlanConflictError();
      }
    },
  });

  await followPlanToday({ changeId, context });

  return true;
}

export function applyNoticeGraph(input: Parameters<typeof settleNoticeGraph>[0]): Promise<boolean> {
  // Placement can make the plan stale between loading it and saving the notice.
  return withPlanRetry(() => settleNoticeGraph(input));
}
