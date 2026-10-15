import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { markLearnerChanged } from "./mark-learner-changed";

const UNCHANGED = Symbol("unchanged learner write");

type Unchanged<T> = { readonly [UNCHANGED]: T };

/** What a learner write returns when it found nothing to change (see `writeLearnerChange`). */
export function unchanged<const T>(result: T): Unchanged<T> {
  return { [UNCHANGED]: result };
}

function isUnchanged<T, Kept>(written: T | Unchanged<Kept>): written is Unchanged<Kept> {
  return typeof written === "object" && written !== null && UNCHANGED in written;
}

/**
 * Runs one learner-visible write in its own transaction with the learner's revision marked first,
 * so every writer takes its locks in the same order: plans, then learners, then everything else. A
 * write that finds nothing to change returns `unchanged(result)`: the transaction rolls back with
 * its mark, and `result` is the outcome, so no revision is committed for it.
 */
export async function writeLearnerChange<T, Kept = T>(
  { lockPlanIds, planInputs = false, userId }: Parameters<typeof markLearnerChanged>[1],
  write: (tx: TransactionClient) => Promise<T | Unchanged<Kept>>,
): Promise<T | Kept> {
  const rollback = new Error("The learner write changed nothing");
  const kept: { outcome?: { result: Kept } } = {};

  const { data, error } = await safeAsync(() =>
    prisma.$transaction(async (tx) => {
      await markLearnerChanged(tx, { lockPlanIds, planInputs, userId });
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
