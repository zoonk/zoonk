import "server-only";
import { prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { getSkillArea } from "../plans/planner/graph-areas";
import { parsePlanGraph, parsePlanSettings } from "../plans/planner/plan-state";
import { proposePlanChange } from "../plans/propose-plan-change";
import { loadPreparationInputs } from "./_utils/load-preparation-inputs";
import { getAreaPreparations } from "./area-preparation";
import { REBALANCE_SOURCE, pickRebalance } from "./rebalance-rule";

const WEEK_DAYS = 7;

/** For logs and admin only; the apps word a rebalance from its areas. */
const REBALANCE_NOTE = "Moved time to the area that needs it most.";

function toRebalanceAreas({
  areas,
  graph,
  skills,
}: {
  areas: ReturnType<typeof getAreaPreparations>["areas"];
  graph: ReturnType<typeof parsePlanGraph>;
  skills: readonly { areaId: string; skillId: string }[];
}) {
  const planArea = new Map(
    graph.skills.map((skill) => [skill.skillId, getSkillArea({ graph, skill })]),
  );

  return areas.map((area) => ({
    ...area,
    planAreas: skills
      .filter((skill) => skill.areaId === area.areaId)
      .flatMap((skill) => planArea.get(skill.skillId) ?? []),
  }));
}

async function rebalance({
  goalId,
  now,
  retryOnConflict,
  userId,
}: {
  goalId: string;
  now: Date;
  retryOnConflict: boolean;
  userId: string;
}) {
  const plan = await prisma.plan.findUnique({
    select: { graph: true, id: true, settings: true },
    where: { goalId },
  });

  const graph = parsePlanGraph(plan?.graph);

  if (!plan || graph.skills.length === 0) {
    return;
  }

  const [inputs, last] = await Promise.all([
    loadPreparationInputs({ goalId, now, userId }),
    prisma.planChange.findFirst({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
      where: { payload: { equals: REBALANCE_SOURCE, path: ["source"] }, planId: plan.id },
    }),
  ]);

  const { areas, weakestAreaId } = getAreaPreparations({
    ...inputs,
    now,
    weekAgo: new Date(now.getTime() - WEEK_DAYS * MS_PER_DAY),
  });

  const focus = pickRebalance({
    areas: toRebalanceAreas({ areas, graph, skills: inputs.skills }),
    focusAreas: parsePlanSettings(plan.settings).focusAreas,
    lastRebalanceAt: last?.createdAt ?? null,
    now,
    weakestAreaId,
  });

  if (focus) {
    await proposePlanChange({
      goalId,
      operations: [{ areas: focus, kind: "focusAreas" }],
      reason: REBALANCE_NOTE,
      retryOnConflict,
      source: REBALANCE_SOURCE,
    });
  }
}

/** Never throws: a failure is logged. */
export async function rebalancePlanAfterSession({
  goalId,
  now = new Date(),
  retryOnConflict = true,
  userId,
}: {
  goalId: string | null;
  now?: Date;
  retryOnConflict?: boolean;
  userId: string;
}): Promise<void> {
  if (!goalId) {
    return;
  }

  const { error } = await safeAsync(() => rebalance({ goalId, now, retryOnConflict, userId }));

  if (error) {
    logError(`Could not rebalance the plan of goal ${goalId}.`, error);
  }
}
