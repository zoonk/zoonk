import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { markPlanWrite } from "./mark-plan-write";
import { type PlanContext } from "./plan-context";
import { PlanConflictError } from "./write-plan";

/** A proposal belongs to the version it described; a winning plan write makes it obsolete. */
export async function writePlanMetadata<T>({
  plan,
  write,
}: {
  plan: PlanContext["plan"];
  write: (tx: TransactionClient) => Promise<T>;
}): Promise<T> {
  return prisma.$transaction(async (tx) => {
    const marked = await markPlanWrite(tx, plan);

    const current = await tx.plan.count({
      where: { id: marked.id, inputVersion: marked.inputVersion, version: marked.version },
    });

    if (current !== 1) {
      throw new PlanConflictError();
    }

    return write(tx);
  });
}
