import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { PlanConflictError } from "../plan-conflict";
import { type PlanPhase, type PlanState } from "../planner/plan-state";
import { markPlanWrite } from "./mark-plan-write";
import {
  type StoredPlanChangePayload,
  UNDOABLE_KINDS,
  parsePlanChangePayload,
  toPlanChangePayload,
} from "./plan-change-payload";
import { type PlanContext } from "./plan-context";
import { type PlanSummary, reduceCompletedSummary } from "./plan-summary";
import { getGoalUpdate } from "./plan-unchanged";
import { type SavedPlanItem, savePlanItems } from "./save-plan-items";

export type PlanWrite = {
  coveredShare: number | null;
  estimateHours: number | null;
  inputsKey: string | null;
  items: readonly SavedPlanItem[];
  phases: PlanPhase[];
  previews?: { id: string; payload: StoredPlanChangePayload }[];
  standInLessons: ReadonlyMap<string, number>;
  state: PlanState;
  sourceSkillIds: readonly string[];
  summary?: PlanSummary | null;
};

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

function toJsonb(value: unknown) {
  return value === null || value === undefined ? null : JSON.stringify(value);
}

/** Undoing the change restores its snapshot and then re-plans, so the written lessons come back. */
async function carryOpenUndo({
  context,
  tx,
}: {
  context: PlanContext;
  tx: TransactionClient;
}): Promise<string | null> {
  const open = await tx.planChange.findFirst({
    select: { id: true, payload: true },
    where: {
      kind: { in: [...UNDOABLE_KINDS] },
      payload: { equals: context.plan.version, path: ["versionAfter"] },
      planId: context.plan.id,
      snapshot: { isNot: null },
      status: "applied",
    },
  });

  if (!open) {
    return null;
  }

  await tx.planChange.update({
    data: {
      payload: toPlanChangePayload({
        ...parsePlanChangePayload(open.payload),
        replannedSince: true,
        versionAfter: context.plan.version + 1,
      }),
    },
    where: { id: open.id },
  });

  return open.id;
}

export async function writePlan({
  context,
  keepsOpenUndo = false,
  plan,
  tx,
}: {
  context: PlanContext;
  keepsOpenUndo?: boolean;
  plan: PlanWrite;
  tx: TransactionClient;
}): Promise<void> {
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
          ${[...plan.sourceSkillIds]}::uuid[] || ARRAY(
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

  const keptUndo = keepsOpenUndo ? await carryOpenUndo({ context, tx }) : null;

  await tx.planChangeSnapshot.deleteMany({
    where: {
      change: { planId: context.plan.id },
      ...(keptUndo && { changeId: { not: keptUndo } }),
    },
  });

  await savePlanItems({
    existing: context.items,
    items: plan.items,
    planId: context.plan.id,
    standInLessons: plan.standInLessons,
    tx,
  });

  await creditFinishedNewLessons({ context, plan, tx });

  await saveProposalPreviews({ previews: plan.previews, tx });
}

/** Keeps the plan's version, so a learner's open plan editor isn't in conflict. */
export async function savePlanInputsKey({
  context,
  graph,
  inputsKey,
  summary,
  previews = [],
  extraWrites,
}: {
  context: Pick<PlanContext, "plan">;
  graph: PlanState["graph"];
  inputsKey: string;
  summary?: PlanSummary | null;
  previews?: PlanWrite["previews"];
  extraWrites?: (tx: TransactionClient) => Promise<void>;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const plan = await markPlanWrite(tx, context.plan);

    const { count } = await tx.plan.updateMany({
      data: {
        graph,
        inputsKey,
        ...(summary && { coveredShare: summary.selected.coverage?.coveredShare ?? null, summary }),
      },
      where: { id: plan.id, inputVersion: plan.inputVersion, version: plan.version },
    });

    if (count === 0) {
      throw new PlanConflictError();
    }

    await saveProposalPreviews({ previews, tx });

    await extraWrites?.(tx);
  });
}

export async function saveProposalPreviews({
  tx,
  previews = [],
}: {
  tx: TransactionClient;
  previews?: PlanWrite["previews"];
}): Promise<void> {
  await Promise.all(
    previews.map((preview) =>
      tx.planChange.updateMany({
        data: { payload: preview.payload },
        where: { id: preview.id, status: "proposed" },
      }),
    ),
  );
}
