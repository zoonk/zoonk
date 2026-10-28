import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { type PlanOperation } from "../plan-contract";
import { getChangeLevers, replacesProposal } from "./change-levers";
import { type PlanChangeSource, parsePlanChangePayload } from "./plan-change-payload";

/**
 * A change applied re-plans from today and lays the phase dates out again, so it changes the phase
 * dates too: a proposal to move the ones the learner saw no longer describes the plan (the next
 * system refresh asks again when keeping the new ones leaves lessons out).
 */
const APPLIED_LEVERS = ["phaseDates"];

export type ProposalReplacement = {
  applied: boolean;
  except?: string | null;
  operations: readonly PlanOperation[];
  source: PlanChangeSource;
};

export function getReplacedProposalIds({
  waiting,
  replacement,
}: {
  waiting: readonly { id: string; payload: unknown }[];
  replacement: ProposalReplacement;
}): string[] {
  const newer = new Set([
    ...getChangeLevers(replacement),
    ...(replacement.applied ? APPLIED_LEVERS : []),
  ]);

  return waiting.flatMap((change) => {
    const payload = parsePlanChangePayload(change.payload);
    const levers = getChangeLevers({ operations: payload.operations, source: payload.source });

    return change.id !== replacement.except && replacesProposal({ newer, waiting: levers })
      ? [change.id]
      : [];
  });
}

/**
 * One rule for every proposal, whoever made it (the buddy, the exam's notice, memory, a
 * rebalance): it waits for the learner's own answer until a newer change, proposed or made,
 * changes the same thing (see `getChangeLevers`, and `APPLIED_LEVERS` for a change applied). Then
 * it's `replaced`, so the learner never answers two changes that contradict, and its card says so.
 * Proposals about other things stay answerable. Returns the ones it replaced.
 */
export async function replaceWaitingProposals({
  applied,
  except = null,
  operations,
  planId,
  source,
  tx,
}: {
  applied: boolean;
  except?: string | null;
  operations: readonly PlanOperation[];
  planId: string;
  source: PlanChangeSource;
  tx: TransactionClient;
}): Promise<string[]> {
  const waiting = await tx.planChange.findMany({
    select: { id: true, payload: true },
    where: { planId, status: "proposed", ...(except ? { id: { not: except } } : {}) },
  });

  const replaced = getReplacedProposalIds({
    replacement: { applied, except, operations, source },
    waiting,
  });

  if (replaced.length > 0) {
    await tx.planChange.updateMany({
      data: { status: "replaced" },
      where: { id: { in: replaced }, status: "proposed" },
    });
  }

  return replaced;
}
