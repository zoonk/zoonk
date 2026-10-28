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
  await markPlansChanged(tx, { planIds });
  await lockSources();
  const currentPlanIds = await loadPlanIds();
  const marked = new Set(planIds);

  if (currentPlanIds.some((id) => !marked.has(id))) {
    throw new PlanInputWriteConflictError("Plan inputs changed; try the write again.");
  }
}

export function lockPlanSourceWrite(tx: TransactionClient, roots: PlanInputRoots): Promise<void> {
  return lockPlanInputWrite({
    loadPlanIds: () => resolvePlanInputDependents(tx, roots),
    lockSources: async () => lockSourceRoots(tx, await loadPlanInputSources(tx, roots)),
    tx,
  });
}

export function lockPlanBlueprintWrite(tx: TransactionClient, blueprintId: string): Promise<void> {
  return lockPlanInputWrite({
    loadPlanIds: () => resolvePlanInputDependents(tx, { blueprintIds: [blueprintId] }),
    lockSources: () => lockSourceBlueprint(tx, blueprintId),
    tx,
  });
}

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
