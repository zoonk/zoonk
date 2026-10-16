import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { markPlansChanged } from "../../learner/_utils/mark-learner-changed";
import {
  type PlanInputRoots,
  loadPlanInputSources,
  resolvePlanInputDependents,
} from "../../plans/_utils/plan-input-dependencies";
import { lockSourceBlueprint, lockSourceRoots } from "../../plans/_utils/plan-source-publication";

export class PlanInputWriteConflictError extends Error {
  override name = "PlanInputWriteConflictError";
}

/** Sources may gain dependents while marking waits; expansion restarts before any more locks. */
export async function lockPlanInputWrite({
  loadPlanIds,
  lockSources,
  tx,
}: {
  loadPlanIds: () => Promise<readonly string[]>;
  lockSources: () => Promise<void>;
  tx: TransactionClient;
}): Promise<void> {
  const planIds = await loadPlanIds();
  await markPlansChanged(tx, { adaptation: ["content"], planIds });
  await lockSources();
  const currentPlanIds = await loadPlanIds();
  const marked = new Set(planIds);

  if (currentPlanIds.some((id) => !marked.has(id))) {
    throw new PlanInputWriteConflictError("Plan inputs changed; try the write again.");
  }
}

/**
 * A content write's locks, before it changes its rows: it marks every plan that reads these roots
 * (`content`), locks the lessons and skills plans read them through (`loadPlanInputSources`), and
 * then finds the plans again, so a plan that started reading them meanwhile throws and the write
 * starts over (see `writePlanInputs`).
 */
export function lockPlanSourceWrite(tx: TransactionClient, roots: PlanInputRoots): Promise<void> {
  return lockPlanInputWrite({
    loadPlanIds: () => resolvePlanInputDependents(tx, roots),
    lockSources: async () => lockSourceRoots(tx, await loadPlanInputSources(tx, roots)),
    tx,
  });
}

/**
 * The same for a write of an exam's own facts (its shared graph, its structure): plans read them
 * through the goal's exam, so the exam's row is what it locks.
 */
export function lockPlanBlueprintWrite(tx: TransactionClient, blueprintId: string): Promise<void> {
  return lockPlanInputWrite({
    loadPlanIds: () => resolvePlanInputDependents(tx, { blueprintIds: [blueprintId] }),
    lockSources: () => lockSourceBlueprint(tx, blueprintId),
    tx,
  });
}

/** A retry releases every plan, user and source lock before collecting the complete union again. */
export async function writePlanInputs<T>(
  write: (tx: TransactionClient) => Promise<T>,
  attempt = 1,
): Promise<T> {
  const { data, error } = await safeAsync(() => prisma.$transaction(write));

  if (error instanceof PlanInputWriteConflictError && attempt < 2) {
    return writePlanInputs(write, attempt + 1);
  }

  if (error) {
    throw error;
  }

  return data;
}
