import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { NEW_SKILL_MEMORY } from "./fsrs-scheduler";

/** A goal's written skills with no written answer, and the plan's test-outs of them. */
export type UnprovenWritten = { itemIds: readonly string[]; skillIds: readonly string[] };

/** Only a written answer shows a written skill: test-outs go back to do and settled memory to new. */
export async function forgetUnprovenWrittenClaims({
  planId,
  tx,
  unproven,
  userId,
}: {
  planId: string;
  tx: TransactionClient;
  unproven: UnprovenWritten;
  userId: string;
}): Promise<void> {
  if (unproven.itemIds.length > 0) {
    await tx.planItem.updateMany({
      data: { completedAt: null, status: "todo" },
      where: { id: { in: [...unproven.itemIds] }, planId, status: "testedOut" },
    });
  }

  if (unproven.skillIds.length > 0) {
    await tx.learnerSkill.updateMany({
      data: NEW_SKILL_MEMORY,
      where: {
        skillId: { in: [...unproven.skillIds] },
        state: { in: ["mastered", "solid"] },
        userId,
      },
    });
  }
}
