import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { PlanConflictError } from "../plan-conflict";
import { type PlanPhase, type PlanState } from "../planner/plan-state";
import { markPlanWrite } from "./mark-plan-write";
import { type PlanContext } from "./plan-context";
import { type PlanSummary, reduceCompletedSummary } from "./plan-summary";
import { getGoalUpdate } from "./plan-unchanged";
import { type SavedPlanItem, savePlanItems } from "./save-plan-items";

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
  summary?: PlanSummary | null;
};

/**
 * Counts what the write's new lesson items were saved done with: a lesson the learner finished
 * elsewhere (another goal, the Library) is done from when it ended (see `savePlanItems`), which the
 * summary the write posted read as still to do. Only a lesson it counted short changes what it
 * covers (see `reduceCompletedSummary`), so there's nothing to read while none of them is new.
 */
async function creditFinishedNewLessons({
  context,
  plan,
  tx,
}: {
  context: PlanContext;
  plan: PlanWrite;
  tx: TransactionClient;
}): Promise<void> {
  const short = new Set(
    plan.summary?.selected.coverage?.shortLessons.map((lesson) => lesson.lessonId),
  );

  const kept = new Set(context.items.map((item) => item.id));

  const lessonIds = plan.items.flatMap((item) =>
    item.lessonId && short.has(item.lessonId) && !(item.id && kept.has(item.id))
      ? [item.lessonId]
      : [],
  );

  if (!plan.summary || lessonIds.length === 0) {
    return;
  }

  const completed = await tx.planItem.findMany({
    select: { lessonId: true },
    where: { lessonId: { in: lessonIds }, planId: context.plan.id, status: "done" },
  });

  const reduction = reduceCompletedSummary({ completed, summary: plan.summary });

  if (reduction.kind === "reduced") {
    await tx.plan.update({
      data: { coveredShare: reduction.coveredShare, summary: reduction.summary },
      where: { id: context.plan.id },
    });
  }
}

/** A value as the JSON a `jsonb` column stores, or SQL null. */
function toJsonb(value: unknown) {
  return value === null || value === undefined ? null : JSON.stringify(value);
}

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
  // The skills a waiting proposal's quote read stay sources with the build's own (see
  // `resolvePlanInputDependents`): a content write to one of them still marks the plan, so the
  // quote can't outlive what it was quoted from. Read in the compare-and-set, so it costs nothing.
  const count = await tx.$executeRaw`
    UPDATE plans SET
      covered_share = ${plan.coveredShare},
      estimate_hours = ${plan.estimateHours},
      graph = ${toJsonb(plan.state.graph)}::jsonb,
      inputs_key = ${plan.inputsKey},
      phases = ${toJsonb(plan.phases)}::jsonb,
      settings = ${toJsonb(plan.state.settings)}::jsonb,
      source_skill_ids = ARRAY(
        SELECT DISTINCT source FROM unnest(
          ${[...(plan.sourceSkillIds ?? [])]}::uuid[] || ARRAY(
            SELECT quoted.source::uuid
            FROM plan_changes AS change,
              jsonb_array_elements_text(
                CASE WHEN jsonb_typeof(change.payload -> 'quoteSourceSkillIds') = 'array'
                  THEN change.payload -> 'quoteSourceSkillIds' ELSE '[]'::jsonb END
              ) AS quoted(source)
            WHERE change.plan_id = ${context.plan.id}::uuid
              AND change.status = 'proposed'::"PlanChangeStatus"
              AND quoted.source ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          )
        ) AS source
        ORDER BY source
      ),
      summary = ${toJsonb(plan.summary)}::jsonb,
      updated_at = ${new Date()},
      version = version + 1
    WHERE id = ${context.plan.id}::uuid
      AND input_version = ${context.plan.inputVersion}
      AND version = ${context.plan.version}
  `;

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

  await creditFinishedNewLessons({ context, plan, tx });
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
    const plan = await markPlanWrite(tx, context.plan);

    const { count } = await tx.plan.updateMany({
      data: { graph, inputsKey },
      where: { id: plan.id, inputVersion: plan.inputVersion, version: plan.version },
    });

    if (count === 0) {
      throw new PlanConflictError();
    }
  });
}
