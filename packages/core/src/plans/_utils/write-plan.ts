import "server-only";
import { DbNull, type TransactionClient, prisma } from "@zoonk/db";
import { type PlanPhase, type PlanState } from "../planner/plan-state";
import { markPlanWrite } from "./mark-plan-write";
import { type PlanContext } from "./plan-context";
import { type SavedPlanSummary } from "./plan-summary";
import { getGoalUpdate } from "./plan-unchanged";
import { type SavedPlanItem, savePlanItems } from "./save-plan-items";

/** Another planning run committed first; the caller reloads and tries again. */
export class PlanConflictError extends Error {
  constructor() {
    super("The plan changed while it was being planned.");
    this.name = "PlanConflictError";
  }
}

/** What a commit writes on a plan: its state, phases and numbers, and its items in order. */
export type PlanWrite = {
  coveredShare: number | null;
  estimateHours: number | null;
  /** What the plan was planned from (see `getPlanInputsKey`); null when that isn't known. */
  inputsKey: string | null;
  items: readonly SavedPlanItem[];
  phases: PlanPhase[];
  /** The lessons each skill's stand-in teaches (see `savePlanItems`). */
  standInLessons: ReadonlyMap<string, number>;
  state: PlanState;
  sourceSkillIds?: readonly string[];
  summary?: SavedPlanSummary | null;
};

/**
 * Writes a plan inside a transaction: its state, phases and numbers, the goal's time settings and
 * its items (see `savePlanItems`). The plan's version guards against a concurrent run. Every write
 * ends the undo of the plan's earlier changes (see `canUndoChange`), so their snapshots go.
 */
export async function writePlan({
  context,
  plan,
  tx,
}: {
  context: PlanContext;
  plan: PlanWrite;
  tx: TransactionClient;
}): Promise<void> {
  const { count } = await tx.plan.updateMany({
    data: {
      coveredShare: plan.coveredShare,
      estimateHours: plan.estimateHours,
      graph: plan.state.graph,
      inputsKey: plan.inputsKey,
      phases: plan.phases,
      settings: plan.state.settings,
      sourceSkillIds: [...(plan.sourceSkillIds ?? [])],
      summary: plan.summary ?? DbNull,
      version: { increment: 1 },
    },
    where: {
      id: context.plan.id,
      inputVersion: context.plan.inputVersion,
      version: context.plan.version,
    },
  });

  if (count === 0) {
    throw new PlanConflictError();
  }

  const goalUpdate = getGoalUpdate({ context, state: plan.state });

  if (goalUpdate) {
    await tx.goal.update({ data: goalUpdate, where: { id: context.goal.id } });
  }

  await tx.planChangeSnapshot.deleteMany({ where: { change: { planId: context.plan.id } } });

  await savePlanItems({
    existing: context.items,
    items: plan.items,
    planId: context.plan.id,
    standInLessons: plan.standInLessons,
    tx,
  });
}

/**
 * Keeps the key of what a run planned from (see `getPlanInputsKey`) on a plan it left as it was
 * (see `isPlanUnchanged`): a later refresh with the same inputs has nothing new to plan. The graph
 * goes with it, with the lessons that run counted for each skill (`withPlannedLessons`), so a
 * skill's core never lags the key: the Library can grow past what a plan short on time keeps. The
 * version stays, so a learner's open plan editor isn't in conflict, and a plan another run saved
 * since keeps its own key.
 */
export async function savePlanInputsKey({
  context,
  graph,
  inputsKey,
}: {
  context: Pick<PlanContext, "plan">;
  graph: PlanState["graph"];
  inputsKey: string;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const marked = await markPlanWrite(tx, context.plan);

    const { count } = await tx.plan.updateMany({
      data: { graph, inputsKey },
      where: { id: marked.id, inputVersion: marked.inputVersion, version: marked.version },
    });

    if (count === 0) {
      throw new PlanConflictError();
    }
  });
}
