import "server-only";
import {
  type MemoryCategory,
  type MemoryFact,
  type MemoryOrigin,
  type TransactionClient,
  prisma,
} from "@zoonk/db";
import { type MemorySource } from "../memory-contract";
import { forgetExampleLines } from "./forget-example-lines";

/** A replaced fact's history is short; this bounds the walk if rows were ever edited by hand. */
const MAX_HISTORY_DEPTH = 50;

export type NewMemoryFact = {
  category: MemoryCategory;
  statement: string;
  origin: MemoryOrigin;
  confidence: number;
  sensitive: boolean;
  source: MemorySource | null;
  expiresAt: Date | null;
  provenance: { generatedAt: Date; model: string; promptVersion: string; runId: string } | null;
};

function toFactData({ fact, userId }: { fact: NewMemoryFact; userId: string }) {
  return {
    category: fact.category,
    confidence: fact.confidence,
    expiresAt: fact.expiresAt,
    generatedAt: fact.provenance?.generatedAt,
    model: fact.provenance?.model,
    origin: fact.origin,
    promptVersion: fact.provenance?.promptVersion,
    runId: fact.provenance?.runId,
    sensitive: fact.sensitive,
    sourceRef: fact.source ?? undefined,
    statement: fact.statement,
    userId,
  };
}

export async function addMemoryFact({
  fact,
  userId,
}: {
  fact: NewMemoryFact;
  userId: string;
}): Promise<MemoryFact> {
  return prisma.memoryFact.create({ data: toFactData({ fact, userId }) });
}

/**
 * Stores the new fact and marks the old one as replaced by it, in one transaction, and lets go of
 * the example lines that could quote the old one. Returns null, writing nothing, when the old fact
 * stopped being active meanwhile (another update got there first), so two runs never replace the
 * same fact twice.
 */
export async function replaceMemoryFact({
  fact,
  previousId,
  userId,
}: {
  fact: NewMemoryFact;
  previousId: string;
  userId: string;
}): Promise<{ fact: MemoryFact; previous: MemoryFact } | null> {
  return prisma.$transaction(async (transaction) => {
    const created = await transaction.memoryFact.create({ data: toFactData({ fact, userId }) });

    const { count } = await transaction.memoryFact.updateMany({
      data: { status: "superseded", supersededById: created.id },
      where: { id: previousId, status: "active", userId },
    });

    if (count === 0) {
      await transaction.memoryFact.delete({ where: { id: created.id } });
      return null;
    }

    await forgetExampleLines({ client: transaction, userId });

    const previous = await transaction.memoryFact.findUniqueOrThrow({ where: { id: previousId } });
    return { fact: created, previous };
  });
}

/**
 * The facts a fact replaced, and the ones those replaced, with the status they're in now. Deleting
 * a fact deletes this history too: a learner who deletes "Wants Law" doesn't expect Zoonk to keep
 * the "Wants Medicine" it replaced.
 */
export async function findHistoryIds({
  factId,
  status,
  transaction,
}: {
  factId: string;
  status: "deleted" | "superseded";
  transaction: TransactionClient;
}): Promise<string[]> {
  const walk = async (frontier: string[], depth: number): Promise<string[]> => {
    if (frontier.length === 0 || depth >= MAX_HISTORY_DEPTH) {
      return [];
    }

    const rows = await transaction.memoryFact.findMany({
      select: { id: true },
      where: { status, supersededById: { in: frontier } },
    });

    const ids = rows.map((row) => row.id);
    return [...ids, ...(await walk(ids, depth + 1))];
  };

  return walk([factId], 0);
}

/**
 * Deletes an active fact, its history and the example lines that could quote it. Deleted facts stay
 * 30 days so the learner can undo, then `purgeMemoryFacts` removes them for good. Returns null when
 * the fact isn't the learner's active fact.
 */
export async function removeMemoryFact({
  factId,
  userId,
}: {
  factId: string;
  userId: string;
}): Promise<MemoryFact | null> {
  return prisma.$transaction(async (transaction) => {
    const deletedAt = new Date();

    const { count } = await transaction.memoryFact.updateMany({
      data: { deletedAt, status: "deleted" },
      where: { id: factId, status: "active", userId },
    });

    if (count === 0) {
      return null;
    }

    const historyIds = await findHistoryIds({ factId, status: "superseded", transaction });

    await Promise.all([
      transaction.memoryFact.updateMany({
        data: { deletedAt, status: "deleted" },
        where: { id: { in: historyIds }, userId },
      }),
      forgetExampleLines({ client: transaction, userId }),
    ]);

    return transaction.memoryFact.findUniqueOrThrow({ where: { id: factId } });
  });
}

/**
 * Brings back a fact deleted by `removeMemoryFact`, with the history deleted together with it.
 * Returns null when the fact isn't a deleted fact of this learner.
 */
export async function restoreRemovedMemoryFact({
  factId,
  transaction,
  userId,
}: {
  factId: string;
  transaction: TransactionClient;
  userId: string;
}): Promise<MemoryFact | null> {
  const fact = await transaction.memoryFact.findFirst({
    where: { id: factId, status: "deleted", userId },
  });

  if (!fact) {
    return null;
  }

  const historyIds = await findHistoryIds({ factId, status: "deleted", transaction });

  await Promise.all([
    transaction.memoryFact.update({
      data: { deletedAt: null, status: "active" },
      where: { id: factId },
    }),
    transaction.memoryFact.updateMany({
      data: { deletedAt: null, status: "superseded" },
      where: { deletedAt: fact.deletedAt, id: { in: historyIds }, userId },
    }),
  ]);

  return transaction.memoryFact.findUniqueOrThrow({ where: { id: factId } });
}
