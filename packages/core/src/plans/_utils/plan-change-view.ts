import "server-only";
import { type PlanChange, prisma } from "@zoonk/db";
import { OWN_LEVEL_SOURCE } from "../own-level-contract";
import { type PlanChangeView } from "../plan-view-contract";
import { addDays } from "../planner/plan-calendar";
import { parsePlanChangePayload } from "./plan-change-payload";

/** Changes stay on the plan for two weeks; proposals stay until the learner answers. */
const RECENT_CHANGE_DAYS = 14;
const MAX_CHANGES = 10;

/**
 * The app says changes from these sources itself, from their kind and operations (a rebalance
 * after a session is "preparation"); other sources wrote a sentence for the learner.
 */
const LEARNER_FACING_SOURCES = new Set(["learner", OWN_LEVEL_SOURCE, "preparation", "system"]);

/**
 * Edits and test-outs can be undone while the plan is exactly as they left it. Any later change
 * (another edit, missed days re-flowing) ends the undo, so an undo never reverts something else.
 */
export function canUndoChange({
  change,
  planVersion,
}: {
  change: Pick<PlanChange, "kind" | "payload" | "status">;
  planVersion: number;
}): boolean {
  const undoable = change.kind === "edited" || change.kind === "testedOut";

  return (
    undoable &&
    change.status === "applied" &&
    parsePlanChangePayload(change.payload).versionAfter === planVersion
  );
}

export function toPlanChangeView({
  change,
  planVersion,
}: {
  change: PlanChange;
  planVersion: number;
}): PlanChangeView {
  const payload = parsePlanChangePayload(change.payload);

  return {
    canUndo: canUndoChange({ change, planVersion }),
    createdAt: change.createdAt.toISOString(),
    days: payload.days,
    effect: payload.effect,
    id: change.id,
    kind: change.kind,
    lessonsSkipped: payload.lessons ?? payload.planItemIds.length,
    operations: payload.operations,
    reason: LEARNER_FACING_SOURCES.has(payload.source) ? null : change.reason,
    source: payload.source,
    status: change.status,
  };
}

/** Proposals waiting for the learner's OK, then the changes of the last two weeks, newest first. */
export async function loadPlanChangeViews({
  now,
  planId,
  planVersion,
}: {
  now: Date;
  planId: string;
  planVersion: number;
}): Promise<PlanChangeView[]> {
  const changes = await prisma.planChange.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: MAX_CHANGES,
    where: {
      OR: [{ status: "proposed" }, { createdAt: { gte: addDays(now, -RECENT_CHANGE_DAYS) } }],
      planId,
    },
  });

  return changes
    .toSorted((a, b) => Number(b.status === "proposed") - Number(a.status === "proposed"))
    .map((change) => toPlanChangeView({ change, planVersion }));
}
