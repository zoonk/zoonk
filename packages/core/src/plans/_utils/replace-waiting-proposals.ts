import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { type PlanOperation } from "../plan-contract";
import { getChangeLevers, replacesProposal } from "./change-levers";
import { type PlanChangeSource, parsePlanChangePayload } from "./plan-change-payload";

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
