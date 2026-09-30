import { type TransactionClient, type UsageKind, prisma, sql } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { type UsageDecision } from "../contract";
import {
  NEWCOMER_ACCOUNT_AGE_DAYS,
  NEWCOMER_DAILY_SPEND_BUDGET_MICROS,
  getEstimatedCostMicros,
} from "../limits";
import { type EntitlementViewer } from "./entitlement-viewer";
import { evaluateUsage } from "./evaluate-usage";
import { claimNewcomerSpend } from "./newcomer-spend-budget";
import { countUsage } from "./usage-counts";

/** Namespaces the per-learner advisory lock so it never collides with other locks. */
const USAGE_LOCK_NAMESPACE = 51_873;

/**
 * Guests and free accounts younger than a day share the newcomers' daily budget: an account made
 * by a script is as unproven as a guest. Plus learners pay, so they never do.
 */
async function isNewcomer({
  now,
  transaction,
  viewer,
}: {
  now: Date;
  transaction: TransactionClient;
  viewer: EntitlementViewer;
}): Promise<boolean> {
  if (viewer.isGuest) {
    return true;
  }

  if (viewer.tier !== "free") {
    return false;
  }

  const user = await transaction.user.findUnique({
    select: { createdAt: true },
    where: { id: viewer.userId },
  });

  return Boolean(
    user && now.getTime() - user.createdAt.getTime() < NEWCOMER_ACCOUNT_AGE_DAYS * MS_PER_DAY,
  );
}

/**
 * Counts and records one use in a transaction that holds a per-learner lock, so two tabs starting
 * lessons at once can't both take the last one. A target the learner already used returns allowed
 * without counting again: restarting a lesson or retrying a request is free. A newcomer's use that
 * costs AI also takes its estimated cost from the newcomers' shared daily budget.
 */
export async function claimUsageForViewer({
  generated,
  kind,
  now,
  targetId,
  viewer,
}: {
  generated: boolean;
  kind: UsageKind;
  now: Date;
  targetId: string;
  viewer: EntitlementViewer;
}): Promise<UsageDecision> {
  return prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw(
      sql`SELECT pg_advisory_xact_lock(${USAGE_LOCK_NAMESPACE}::int, hashtext(${viewer.userId}))::text`,
    );

    const existing = await transaction.usageRecord.findUnique({
      where: { userUsageTarget: { kind, targetId, userId: viewer.userId } },
    });

    if (existing) {
      return { status: "allowed" };
    }

    const costMicros = getEstimatedCostMicros({ generated, kind });
    const counts = await countUsage({ client: transaction, kind, now, userId: viewer.userId });
    const decision = evaluateUsage({ costMicros, counts, generated, kind, now, tier: viewer.tier });

    if (decision.status !== "allowed") {
      return decision;
    }

    const takesNewcomerBudget = costMicros > 0 && (await isNewcomer({ now, transaction, viewer }));

    if (takesNewcomerBudget && !(await claimNewcomerSpend({ costMicros, now, transaction }))) {
      return {
        limit: {
          limit: NEWCOMER_DAILY_SPEND_BUDGET_MICROS,
          period: "day",
          resource: "newcomerSpend",
          tier: viewer.tier,
        },
        status: "limitReached",
      };
    }

    await transaction.usageRecord.create({
      data: { costMicros, createdAt: now, generated, kind, targetId, userId: viewer.userId },
    });

    return decision;
  });
}
