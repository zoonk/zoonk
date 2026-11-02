import "server-only";
import {
  type MemoryCategory,
  type MemoryFact,
  type MemoryOrigin,
  type TransactionClient,
} from "@zoonk/db";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { type MemorySource } from "../memory-contract";
import { forgetExampleLines } from "./forget-example-lines";

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
  return writeLearnerChange({ userId }, (transaction) =>
    transaction.memoryFact.create({ data: toFactData({ fact, userId }) }),
  );
}

/** Returns null, writing nothing, when another update already replaced or removed the old fact. */
export async function replaceMemoryFact({
  fact,
  previousId,
  userId,
}: {
  fact: NewMemoryFact;
  previousId: string;
  userId: string;
}): Promise<{ fact: MemoryFact; previous: MemoryFact } | null> {
  return writeLearnerChange({ userId }, async (transaction) => {
    const existing = await transaction.memoryFact.findFirst({
      where: { id: previousId, status: "active", userId },
    });

    if (!existing) {
      return unchanged(null);
    }

    const created = await transaction.memoryFact.create({ data: toFactData({ fact, userId }) });

    const [previous] = await transaction.memoryFact.updateManyAndReturn({
      data: { status: "superseded", supersededById: created.id },
      where: { id: previousId, status: "active", userId },
    });

    if (!previous) {
      return unchanged(null);
    }

    await forgetExampleLines({ client: transaction, userId });
    return { fact: created, previous };
  });
}

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

export async function removeMemoryFact({
  factId,
  userId,
}: {
  factId: string;
  userId: string;
}): Promise<MemoryFact | null> {
  return writeLearnerChange({ userId }, async (transaction) => {
    const deletedAt = new Date();

    const [removed] = await transaction.memoryFact.updateManyAndReturn({
      data: { deletedAt, status: "deleted" },
      where: { id: factId, status: "active", userId },
    });

    if (!removed) {
      return unchanged(null);
    }

    const historyIds = await findHistoryIds({ factId, status: "superseded", transaction });

    await Promise.all([
      transaction.memoryFact.updateMany({
        data: { deletedAt, status: "deleted" },
        where: { id: { in: historyIds }, userId },
      }),
      forgetExampleLines({ client: transaction, userId }),
    ]);

    return removed;
  });
}

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

  const [restored] = await Promise.all([
    transaction.memoryFact.update({
      data: { deletedAt: null, status: "active" },
      where: { id: factId },
    }),
    transaction.memoryFact.updateMany({
      data: { deletedAt: null, status: "superseded" },
      where: { deletedAt: fact.deletedAt, id: { in: historyIds }, userId },
    }),
  ]);

  return restored;
}
