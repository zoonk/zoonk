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
type GenerationQuotaCounterTarget = { actorKey: string; rule: GenerationQuotaRule };
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

/** Expands every identity and period into the counters one generation must claim together. */
function getQuotaCounterTargets({
  actorKeys,
  rules,
}: {
  actorKeys: string[];
  rules: GenerationQuotaRule[];
}): GenerationQuotaCounterTarget[] {
  return actorKeys.flatMap((actorKey) => rules.map((rule) => ({ actorKey, rule })));
}

/** Creates missing period buckets before conditional increments acquire their row locks. */
async function ensureQuotaCounters({
  counterTargets,
  resource,
  transaction,
}: {
  counterTargets: GenerationQuotaCounterTarget[];
  resource: GenerationQuotaResource;
  transaction: TransactionClient;
}) {
  await transaction.generationQuotaCounter.createMany({
    data: counterTargets.map((target) => ({
      actorKey: target.actorKey,
      period: target.rule.period,
      periodStart: target.rule.periodStart,
      resource,
    })),
    skipDuplicates: true,
  });
}

/** Conditionally increments one identity-period counter and keeps its rule beside the result. */
async function incrementQuotaCounter({
  counterTarget,
  resource,
  transaction,
}: {
  counterTarget: GenerationQuotaCounterTarget;
  resource: GenerationQuotaResource;
  transaction: TransactionClient;
}) {
  const increment = await transaction.generationQuotaCounter.updateMany({
    data: { count: { increment: 1 } },
    where: {
      actorKey: counterTarget.actorKey,
      count: { lt: counterTarget.rule.limit },
      period: counterTarget.rule.period,
      periodStart: counterTarget.rule.periodStart,
      resource,
    },
  });

  return { increment, rule: counterTarget.rule };
}

/** Increments only counters still below their entitlement and returns each conditional update result. */
async function incrementQuotaCounters({
  counterTargets,
  resource,
  transaction,
}: {
  counterTargets: GenerationQuotaCounterTarget[];
  resource: GenerationQuotaResource;
  transaction: TransactionClient;
}) {
  return Promise.all(
    counterTargets.map((counterTarget) =>
      incrementQuotaCounter({ counterTarget, resource, transaction }),
    ),
  );
}

/** Keeps the durable claim row tied to one stable identity while all identities share its idempotency. */
function getPrimaryActorKey(actorKeys: string[]): string {
  const actorKey = actorKeys[0];

  if (!actorKey) {
    throw new Error("Generation quota requires at least one actor identity");
  }

  return actorKey;
}

/**
 * Claims the target once globally, then increments its daily and monthly
 * counters in one transaction. A duplicate target returns ready without
 * charging again, which keeps browser retries and duplicate workflow starts
 * idempotent.
 */
async function claimQuotaInTransaction({
  actorKeys,
  resource,
  rules,
  targetId,
  transaction,
  viewer,
}: {
  actorKeys: string[];
  resource: GenerationQuotaResource;
  rules: GenerationQuotaRule[];
  targetId: string;
  transaction: TransactionClient;
  viewer: GenerationQuotaViewer;
}): Promise<GenerationQuotaResult> {
  const actorKey = getPrimaryActorKey(actorKeys);

  const claim = await transaction.generationQuotaClaim.createMany({
    data: [{ actorKey, resource, targetId }],
    skipDuplicates: true,
  });

  if (claim.count === 0) {
    return { status: "ready" };
  }

  const counterTargets = getQuotaCounterTargets({ actorKeys, rules });
  await ensureQuotaCounters({ counterTargets, resource, transaction });
  const increments = await incrementQuotaCounters({ counterTargets, resource, transaction });
  const blockedIncrement = increments.find(({ increment }) => increment.count === 0);

  if (blockedIncrement) {
    throw new Error("Generation quota reached", {
      cause: getReachedLimitSignal({ period: blockedIncrement.rule.period, resource, viewer }),
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
  const { actorKeys, viewer } = await getGenerationQuotaViewer();
  const rules = getGenerationQuotaRules({ now, resource, viewer });

  try {
    return await prisma.$transaction((transaction) =>
      claimQuotaInTransaction({ actorKeys, resource, rules, targetId, transaction, viewer }),
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
