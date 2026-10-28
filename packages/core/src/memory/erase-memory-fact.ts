import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getMemoryCacheTag } from "../cache/tags";
import { unchanged, writeLearnerChange } from "../learner/_utils/write-learner-change";
import { getAdminAccess } from "../users/get-admin-access";
import { forgetExampleLines } from "./_utils/forget-example-lines";
import { findHistoryIds } from "./_utils/memory-writes";

export type MemoryFactEraseResult =
  | { erased: number; status: "erased" }
  | { status: "forbidden" | "notFound" | "unauthorized" };

/**
 * Admins only. Unlike the learner's delete, it can't be undone: the fact, the facts it replaced and
 * their example lines go now.
 */
export async function eraseMemoryFactForSupport(factId: string): Promise<MemoryFactEraseResult> {
  const access = await getAdminAccess();

  if (access !== "ready") {
    return { status: access };
  }

  if (!isUuid(factId)) {
    return { status: "notFound" };
  }

  const fact = await prisma.memoryFact.findUnique({
    select: { userId: true },
    where: { id: factId },
  });

  if (!fact) {
    return { status: "notFound" };
  }

  const result = await writeLearnerChange({ userId: fact.userId }, async (transaction) => {
    const current = await transaction.memoryFact.findUnique({
      select: { status: true },
      where: { id: factId },
    });

    if (!current) {
      return unchanged(null);
    }

    const historyIds = await findHistoryIds({
      factId,
      status: current.status === "deleted" ? "deleted" : "superseded",
      transaction,
    });

    const [{ count }] = await Promise.all([
      transaction.memoryFact.deleteMany({
        where: { id: { in: [factId, ...historyIds] }, userId: fact.userId },
      }),
      forgetExampleLines({ client: transaction, userId: fact.userId }),
    ]);

    return count === 0 ? unchanged(null) : { erased: count, userId: fact.userId };
  });

  if (!result) {
    return { status: "notFound" };
  }

  revalidateCacheTags([getMemoryCacheTag(result.userId)]);

  return { erased: result.erased, status: "erased" };
}
