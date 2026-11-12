import { type TransactionClient, type UsageKind } from "@zoonk/db";
import { type UsageDecision } from "../contract";
import { getEstimatedCostMicros } from "../limits";
import { type EntitlementViewer } from "./entitlement-viewer";
import { evaluateUsage } from "./evaluate-usage";
import { type UsageTotals, addUsage, getUsageCounts } from "./usage-counts";

export type BundleClaim = { generated: boolean; kind: UsageKind; targetId: string };

type PricedClaim = BundleClaim & { costMicros: number };

/**
 * Running usage for claims decided one after another in one request: the totals so far and the
 * targets already claimed, which are free again.
 */
export type UsageLedger = {
  claimed: ReadonlySet<string>;
  now: Date;
  totals: UsageTotals;
  viewer: EntitlementViewer;
};

function toClaimKey({ kind, targetId }: Pick<BundleClaim, "kind" | "targetId">): string {
  return `${kind}:${targetId}`;
}

/** The targets of `claims` the learner already claimed. */
export async function findClaimedTargets({
  claims,
  client,
  userId,
}: {
  claims: readonly BundleClaim[];
  client: TransactionClient;
  userId: string;
}): Promise<Set<string>> {
  const byKind = Map.groupBy(claims, (claim) => claim.kind);

  const rows =
    claims.length === 0
      ? []
      : await client.usageRecord.findMany({
          select: { kind: true, targetId: true },
          where: {
            OR: [...byKind].map(([kind, ofKind]) => ({
              kind,
              targetId: { in: ofKind.map((claim) => claim.targetId) },
            })),
            userId,
          },
        });

  return new Set(rows.map((row) => toClaimKey(row)));
}

type Decided = { decision: UsageDecision; recorded: PricedClaim[]; totals: UsageTotals };

/** Whether one more claim of a kind fits the allowance, as if its target were new. */
export function decideNewClaim({
  claim,
  ledger,
}: {
  claim: Omit<BundleClaim, "targetId">;
  ledger: UsageLedger;
}): UsageDecision {
  return evaluateUsage({
    costMicros: getEstimatedCostMicros(claim),
    counts: getUsageCounts(ledger.totals, claim.kind),
    generated: claim.generated,
    kind: claim.kind,
    now: ledger.now,
    tier: ledger.viewer.tier,
  });
}

function decideClaim({
  claim,
  decided,
  ledger,
}: {
  claim: BundleClaim;
  decided: Decided;
  ledger: UsageLedger;
}): Decided {
  if (decided.decision.status !== "allowed") {
    return decided;
  }

  const costMicros = getEstimatedCostMicros(claim);
  const decision = decideNewClaim({ claim, ledger: { ...ledger, totals: decided.totals } });

  if (decision.status !== "allowed") {
    return { ...decided, decision };
  }

  return {
    decision,
    recorded: [...decided.recorded, { ...claim, costMicros }],
    totals: addUsage({ ...claim, costMicros, now: ledger.now, totals: decided.totals }),
  };
}

/**
 * Decides a bundle of claims, all or none, without writing: each new one counts the ones before
 * it, and one the learner already claimed is free. A refused bundle leaves the ledger as it was.
 */
export function decideBundle({
  claims,
  ledger,
}: {
  claims: readonly BundleClaim[];
  ledger: UsageLedger;
}): { decision: UsageDecision; ledger: UsageLedger; recorded: PricedClaim[] } {
  const fresh = [
    ...new Map(
      claims
        .filter((claim) => !ledger.claimed.has(toClaimKey(claim)))
        .map((claim) => [toClaimKey(claim), claim]),
    ).values(),
  ];

  const decided = fresh.reduce<Decided>(
    (sofar, claim) => decideClaim({ claim, decided: sofar, ledger }),
    { decision: { status: "allowed" }, recorded: [], totals: ledger.totals },
  );

  if (decided.decision.status !== "allowed") {
    return { decision: decided.decision, ledger, recorded: [] };
  }

  return {
    decision: decided.decision,
    ledger: {
      ...ledger,
      claimed: new Set([...ledger.claimed, ...decided.recorded.map((claim) => toClaimKey(claim))]),
      totals: decided.totals,
    },
    recorded: decided.recorded,
  };
}
