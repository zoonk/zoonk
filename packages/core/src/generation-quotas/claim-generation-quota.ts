import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import {
  type GenerationQuotaLimit,
  type GenerationQuotaResource,
  type GenerationQuotaResult,
  type GenerationQuotaViewer,
} from "./contract";
import { getGenerationQuotaRules } from "./limits";
import { getGenerationQuotaViewer } from "./viewer";

type GenerationQuotaRule = ReturnType<typeof getGenerationQuotaRules>[number];
type ReachedLimitSignal = { limit: GenerationQuotaLimit; type: symbol };

const REACHED_LIMIT = Symbol("generation quota reached");

/** Creates the transaction-local signal used to roll back every counter when any required period is full. */
function getReachedLimitSignal({
  period,
  resource,
  viewer,
}: {
  period: GenerationQuotaRule["period"];
  resource: GenerationQuotaResource;
  viewer: GenerationQuotaViewer;
}): ReachedLimitSignal {
  return { limit: { period, resource, viewer }, type: REACHED_LIMIT };
}

/** Distinguishes an expected quota rollback from database and infrastructure failures that must propagate. */
function isReachedLimitSignal(error: unknown): error is ReachedLimitSignal {
  return (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    error.type === REACHED_LIMIT &&
    "limit" in error
  );
}

/** Creates missing period buckets before conditional increments acquire their row locks. */
async function ensureQuotaCounters({
  actorKey,
  resource,
  rules,
  transaction,
}: {
  actorKey: string;
  resource: GenerationQuotaResource;
  rules: GenerationQuotaRule[];
  transaction: TransactionClient;
}) {
  await transaction.generationQuotaCounter.createMany({
    data: rules.map((rule) => ({
      actorKey,
      period: rule.period,
      periodStart: rule.periodStart,
      resource,
    })),
    skipDuplicates: true,
  });
}

/** Increments only counters still below their entitlement and returns each conditional update result. */
async function incrementQuotaCounters({
  actorKey,
  resource,
  rules,
  transaction,
}: {
  actorKey: string;
  resource: GenerationQuotaResource;
  rules: GenerationQuotaRule[];
  transaction: TransactionClient;
}) {
  return Promise.all(
    rules.map((rule) =>
      transaction.generationQuotaCounter.updateMany({
        data: { count: { increment: 1 } },
        where: {
          actorKey,
          count: { lt: rule.limit },
          period: rule.period,
          periodStart: rule.periodStart,
          resource,
        },
      }),
    ),
  );
}

/**
 * Claims the target once globally, then increments its daily and monthly
 * counters in one transaction. A duplicate target returns ready without
 * charging again, which keeps browser retries and duplicate workflow starts
 * idempotent.
 */
async function claimQuotaInTransaction({
  actorKey,
  resource,
  rules,
  targetId,
  transaction,
  viewer,
}: {
  actorKey: string;
  resource: GenerationQuotaResource;
  rules: GenerationQuotaRule[];
  targetId: string;
  transaction: TransactionClient;
  viewer: GenerationQuotaViewer;
}): Promise<GenerationQuotaResult> {
  const claim = await transaction.generationQuotaClaim.createMany({
    data: [{ actorKey, resource, targetId }],
    skipDuplicates: true,
  });

  if (claim.count === 0) {
    return { status: "ready" };
  }

  await ensureQuotaCounters({ actorKey, resource, rules, transaction });
  const increments = await incrementQuotaCounters({ actorKey, resource, rules, transaction });
  const blockedRuleIndex = increments.findIndex((increment) => increment.count === 0);

  if (blockedRuleIndex !== -1) {
    const blockedRule = rules[blockedRuleIndex];

    if (!blockedRule) {
      throw new Error("Generation quota update did not match a configured rule");
    }

    throw new Error("Generation quota reached", {
      cause: getReachedLimitSignal({ period: blockedRule.period, resource, viewer }),
    });
  }

  return { status: "ready" };
}

/**
 * Atomically claims one newly generated target for the current viewer. UTC
 * calendar buckets make the reset behavior deterministic across API regions.
 */
async function claimGenerationQuota({
  now = new Date(),
  resource,
  targetId,
}: {
  now?: Date;
  resource: GenerationQuotaResource;
  targetId: string;
}): Promise<GenerationQuotaResult> {
  const { actorKey, viewer } = await getGenerationQuotaViewer();
  const rules = getGenerationQuotaRules({ now, resource, viewer });

  try {
    return await prisma.$transaction((transaction) =>
      claimQuotaInTransaction({ actorKey, resource, rules, targetId, transaction, viewer }),
    );
  } catch (error) {
    if (error instanceof Error && isReachedLimitSignal(error.cause)) {
      return { limit: error.cause.limit, status: "limitReached" };
    }

    throw error;
  }
}

/** Keeps status-only workflow resumes outside quota accounting at every transport boundary. */
export async function claimGenerationQuotaIfNeeded({
  resource,
  shouldClaimQuota,
  targetId,
}: {
  resource: GenerationQuotaResource;
  shouldClaimQuota: boolean;
  targetId: string;
}): Promise<GenerationQuotaResult> {
  if (!shouldClaimQuota) {
    return { status: "ready" };
  }

  return claimGenerationQuota({ resource, targetId });
}
