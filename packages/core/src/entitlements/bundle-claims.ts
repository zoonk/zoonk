import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { readUsageTotals } from "../learner/facts/usage-totals";
import { type EntitlementViewer } from "./_utils/entitlement-viewer";
import { claimGuestSpend } from "./_utils/guest-spend-budget";
import { loadUsageTotals } from "./_utils/usage-counts";
import {
  type BundleClaim,
  type UsageLedger,
  decideBundle,
  findClaimedTargets,
} from "./_utils/usage-ledger";
import { lockUsageForViewer } from "./_utils/usage-lock";
import { type UsageDecision } from "./contract";

/**
 * For a write that claims bundles one after another: takes the learner's usage lock and loads
 * their totals once, with which of `claims` they already hold.
 */
export async function openUsageLedgerInWrite({
  claims,
  now,
  transaction,
  viewer,
}: {
  claims: readonly BundleClaim[];
  now: Date;
  transaction: TransactionClient;
  viewer: EntitlementViewer;
}): Promise<UsageLedger> {
  await lockUsageForViewer({ transaction, userId: viewer.userId });

  const [totals, claimed] = await Promise.all([
    loadUsageTotals({ client: transaction, now, userId: viewer.userId }),
    findClaimedTargets({ claims, client: transaction, userId: viewer.userId }),
  ]);

  return { claimed, now, totals, viewer };
}

/** GET-only: what the claims would meet now, to tell the learner before they ask. */
export async function readUsageLedger({
  claims,
  now,
  viewer,
}: {
  claims: readonly BundleClaim[];
  now: Date;
  viewer: EntitlementViewer;
}): Promise<UsageLedger> {
  const [totals, claimed] = await Promise.all([
    readUsageTotals(viewer.userId),
    findClaimedTargets({ claims, client: prisma, userId: viewer.userId }),
  ]);

  return { claimed, now, totals, viewer };
}

/**
 * Claims a bundle in the caller's write, all or none, against the ledger the write opened; a
 * guest's also takes its cost from the day all guests share. A refusal writes nothing and returns
 * the ledger unchanged, so the write can go on to the next bundle. The caller expires the
 * allowance tag once it commits.
 */
export async function claimBundleInWrite({
  claims,
  ledger,
  transaction,
}: {
  claims: readonly BundleClaim[];
  ledger: UsageLedger;
  transaction: TransactionClient;
}): Promise<{ decision: UsageDecision; ledger: UsageLedger }> {
  const decided = decideBundle({ claims, ledger });

  if (decided.decision.status !== "allowed" || decided.recorded.length === 0) {
    return { decision: decided.decision, ledger: decided.ledger };
  }

  const { now, viewer } = ledger;
  const costMicros = decided.recorded.reduce((sum, claim) => sum + claim.costMicros, 0);
  const takesGuestBudget = viewer.isGuest && costMicros > 0;

  if (takesGuestBudget && !(await claimGuestSpend({ costMicros, now, transaction }))) {
    return { decision: { status: "signUpRequired" }, ledger };
  }

  await transaction.usageRecord.createMany({
    data: decided.recorded.map((claim) => ({
      costMicros: claim.costMicros,
      createdAt: now,
      generated: claim.generated,
      kind: claim.kind,
      targetId: claim.targetId,
      userId: viewer.userId,
    })),
  });

  return { decision: decided.decision, ledger: decided.ledger };
}
