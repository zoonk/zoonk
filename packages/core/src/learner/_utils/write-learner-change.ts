import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { markLearnerChanged } from "./mark-learner-changed";

const UNCHANGED = Symbol("unchanged learner write");

type Unchanged<T> = { readonly [UNCHANGED]: T };

export function unchanged<const T>(result: T): Unchanged<T> {
  return { [UNCHANGED]: result };
}

function isUnchanged<T, Kept>(written: T | Unchanged<Kept>): written is Unchanged<Kept> {
  return typeof written === "object" && written !== null && UNCHANGED in written;
}

/** Acquires plans before learners before other locks. Returning unchanged(result) rolls back writes and marks but returns result. */
export async function writeLearnerChange<T, Kept = T>(
  marker: Parameters<typeof markLearnerChanged>[1],
  write: (tx: TransactionClient) => Promise<T | Unchanged<Kept>>,
): Promise<T | Kept> {
  const rollback = new Error("The learner write changed nothing");
  const kept: { outcome?: { result: Kept } } = {};

  const { data, error } = await safeAsync(() =>
    prisma.$transaction(async (tx) => {
      await markLearnerChanged(tx, marker);
      const written = await write(tx);

      if (isUnchanged(written)) {
        kept.outcome = { result: written[UNCHANGED] };
        throw rollback;
      }

      return written;
    }),
  );

  if (error === rollback && kept.outcome) {
    return kept.outcome.result;
  }

  if (error) {
    throw error;
  }

  return data;
}
