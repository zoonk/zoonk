import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { markPlansChanged } from "../../learner/_utils/mark-learner-changed";

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
