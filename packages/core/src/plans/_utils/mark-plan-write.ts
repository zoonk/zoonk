import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { markPlansChanged } from "../../learner/_utils/mark-learner-changed";
import { type PlanContext } from "./plan-context";

/** The expected input version after this transaction's first, shared revision mark. */
export async function markPlanWrite(
  tx: TransactionClient,
  plan: PlanContext["plan"],
): Promise<PlanContext["plan"]> {
  await markPlansChanged(tx, { planIds: [plan.id] });
  return { ...plan, inputVersion: plan.inputVersion + 1 };
}
