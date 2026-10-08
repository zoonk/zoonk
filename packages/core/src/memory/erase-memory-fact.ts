import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getMemoryCacheTag } from "../cache/tags";
import { getAdminAccess } from "../users/get-admin-access";
import { forgetExampleLines } from "./_utils/forget-example-lines";
import { findHistoryIds } from "./_utils/memory-writes";

export type MemoryFactEraseResult =
  | { erased: number; status: "erased" }
  | { status: "forbidden" | "notFound" | "unauthorized" };

/**
 * Erases one learner fact for a support request, together with the older facts it replaced and the
 * example lines that could quote them. The learner's own delete keeps facts 30 days for undo; a
 * support request to delete personal data is final, so the rows are removed now. Only admins may
 * do this.
 */
export async function eraseMemoryFactForSupport(factId: string): Promise<MemoryFactEraseResult> {
  const access = await getAdminAccess();

  if (access !== "ready") {
    return { status: access };
  }

  if (!isUuid(factId)) {
    return { status: "notFound" };
  }

  const result = await prisma.$transaction(async (transaction) => {
    const fact = await transaction.memoryFact.findUnique({ where: { id: factId } });

    if (!fact) {
      return null;
    }

    const historyIds = await findHistoryIds({
      factId,
      status: fact.status === "deleted" ? "deleted" : "superseded",
      transaction,
    });

    const [{ count }] = await Promise.all([
      transaction.memoryFact.deleteMany({
        where: { id: { in: [factId, ...historyIds] }, userId: fact.userId },
      }),
      forgetExampleLines({ client: transaction, userId: fact.userId }),
    ]);

    return { erased: count, userId: fact.userId };
  });

  if (!result) {
    return { status: "notFound" };
  }

  revalidateCacheTags([getMemoryCacheTag(result.userId)]);

  return { erased: result.erased, status: "erased" };
}
