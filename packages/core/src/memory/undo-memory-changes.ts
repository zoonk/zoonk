import "server-only";
import { type MemoryFact, type TransactionClient, prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getMemoryCacheTag } from "../cache/tags";
import { getSession } from "../users/get-session";
import { forgetExampleLines } from "./_utils/forget-example-lines";
import { toMemoryFactView } from "./_utils/memory-fact-view";
import { restoreRemovedMemoryFact } from "./_utils/memory-writes";
import {
  type MemoryChangeReference,
  type MemoryFactView,
  type MemoryUndoInput,
} from "./memory-contract";

/** What undoing one change did: the fact it took back and the fact it brought back. */
type UndoneChange = { removedFactId: string | null; restored: MemoryFact | null };

export type MemoryUndoResult =
  | { removedFactIds: string[]; restored: MemoryFactView[]; status: "undone" }
  | { status: "conflict" | "unauthorized" };

/** Thrown inside the transaction so one change that can't be undone rolls back the others. */
class MemoryUndoConflictError extends Error {
  constructor() {
    super("A memory change was already undone or has changed since.");
    this.name = "MemoryUndoConflictError";
  }
}

/** An added fact taken back goes with the example lines that could quote it. */
async function takeBackAddedFact({
  factId,
  transaction,
  userId,
}: {
  factId: string;
  transaction: TransactionClient;
  userId: string;
}) {
  const { count } = await transaction.memoryFact.updateMany({
    data: { deletedAt: new Date(), status: "deleted" },
    where: { id: factId, status: "active", userId },
  });

  if (count === 0) {
    throw new MemoryUndoConflictError();
  }

  await forgetExampleLines({ client: transaction, userId });
}

/** The replaced fact comes back only if it's still the one this fact replaced. */
async function restoreReplacedFact({
  factId,
  previousFactId,
  transaction,
  userId,
}: {
  factId: string;
  previousFactId: string;
  transaction: TransactionClient;
  userId: string;
}): Promise<MemoryFact> {
  const { count } = await transaction.memoryFact.updateMany({
    data: { status: "active", supersededById: null },
    where: { id: previousFactId, status: "superseded", supersededById: factId, userId },
  });

  if (count === 0) {
    throw new MemoryUndoConflictError();
  }

  await takeBackAddedFact({ factId, transaction, userId });
  return transaction.memoryFact.findUniqueOrThrow({ where: { id: previousFactId } });
}

async function restoreRemovedFact({
  previousFactId,
  transaction,
  userId,
}: {
  previousFactId: string;
  transaction: TransactionClient;
  userId: string;
}): Promise<MemoryFact> {
  const restored = await restoreRemovedMemoryFact({ factId: previousFactId, transaction, userId });

  if (!restored) {
    throw new MemoryUndoConflictError();
  }

  return restored;
}

async function undoChange({
  change,
  transaction,
  userId,
}: {
  change: MemoryChangeReference;
  transaction: TransactionClient;
  userId: string;
}): Promise<UndoneChange> {
  const { factId, previousFactId } = change;

  if (factId && previousFactId) {
    const restored = await restoreReplacedFact({ factId, previousFactId, transaction, userId });
    return { removedFactId: factId, restored };
  }

  if (factId) {
    await takeBackAddedFact({ factId, transaction, userId });
    return { removedFactId: factId, restored: null };
  }

  if (!previousFactId) {
    throw new MemoryUndoConflictError();
  }

  const restored = await restoreRemovedFact({ previousFactId, transaction, userId });
  return { removedFactId: null, restored };
}

async function undoInOrder({
  changes,
  transaction,
  userId,
}: {
  changes: readonly MemoryChangeReference[];
  transaction: TransactionClient;
  userId: string;
}): Promise<UndoneChange[]> {
  const undone: UndoneChange[] = [];

  // Later changes may build on earlier ones, so they're undone newest first, one at a time.
  for (const change of changes.toReversed()) {
    // eslint-disable-next-line no-await-in-loop -- Each undo reads the state the previous one left.
    undone.push(await undoChange({ change, transaction, userId }));
  }

  return undone;
}

/**
 * Undoes what a "Memory updated" notice or a delete showed: an added fact is taken back, a replaced
 * fact comes back in place of the new one, and a deleted fact comes back with its history. All
 * changes are undone together or none are, when one of them was already undone or changed since.
 */
export async function undoMemoryChanges(input: MemoryUndoInput): Promise<MemoryUndoResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;

  const result = await prisma
    .$transaction((transaction) => undoInOrder({ changes: input.changes, transaction, userId }))
    .catch((error: unknown) => {
      if (error instanceof MemoryUndoConflictError) {
        return null;
      }

      throw error;
    });

  if (!result) {
    return { status: "conflict" };
  }

  revalidateCacheTags([getMemoryCacheTag(userId)]);

  return {
    removedFactIds: result.flatMap((change) => change.removedFactId ?? []),
    restored: result.flatMap((change) =>
      change.restored ? [toMemoryFactView(change.restored)] : [],
    ),
    status: "undone",
  };
}
