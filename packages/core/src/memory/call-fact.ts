import "server-only";
import { type MemoryCategory, type TransactionClient } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { isMemoryEnabled } from "./_utils/memory-access";
import { currentFactsWhere } from "./_utils/memory-fact-view";

const CALL_FACT_CATEGORIES: MemoryCategory[] = ["goals", "background", "routine", "context"];

const FACT_REST_DAYS = 14;

/**
 * Only what the learner said about their own life, never a study pattern, a preference or a
 * sensitive fact.
 */
function callFactsWhere({ now, userId }: { now: Date; userId: string }) {
  return {
    ...currentFactsWhere({ now, userId }),
    category: { in: CALL_FACT_CATEGORIES },
    origin: "said" as const,
    sensitive: false,
  };
}

function findLastPracticeCall({
  transaction,
  userId,
}: {
  transaction: TransactionClient;
  userId: string;
}) {
  return transaction.languageConversation.findFirst({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { memoryFactId: true },
    where: { kind: "practice", userId },
  });
}

function findRestedFact({
  now,
  transaction,
  userId,
}: {
  now: Date;
  transaction: TransactionClient;
  userId: string;
}) {
  const restedSince = new Date(now.getTime() - FACT_REST_DAYS * MS_PER_DAY);

  return transaction.memoryFact.findFirst({
    orderBy: [{ expiresAt: { nulls: "last", sort: "asc" } }, { createdAt: "desc" }, { id: "desc" }],
    select: { id: true },
    where: {
      ...callFactsWhere({ now, userId }),
      conversations: { none: { createdAt: { gte: restedSince } } },
    },
  });
}

/**
 * The fact a new practice call's character may bring up: at most every other call, never the same
 * fact twice in 14 days, and a dated one (a trip, an interview) before the newest. Call it under the
 * learner lock of the transaction that creates the call, so two calls started at once can't both
 * carry a fact.
 */
export async function findFactForCall({
  now,
  transaction,
  userId,
}: {
  now: Date;
  transaction: TransactionClient;
  userId: string;
}): Promise<string | null> {
  const [enabled, lastCall, fact] = await Promise.all([
    isMemoryEnabled(userId, transaction),
    findLastPracticeCall({ transaction, userId }),
    findRestedFact({ now, transaction, userId }),
  ]);

  if (!enabled || lastCall?.memoryFactId) {
    return null;
  }

  return fact?.id ?? null;
}

/**
 * The call's fact while it still fits a call and memory is on, so one deleted, expired or reworded
 * since the call started stays out. Call it under the learner lock, so a memory change holding the
 * lock is seen.
 */
export async function readCallNote({
  conversationId,
  now,
  transaction,
  userId,
}: {
  conversationId: string;
  now: Date;
  transaction: TransactionClient;
  userId: string;
}): Promise<string | undefined> {
  const [enabled, fact] = await Promise.all([
    isMemoryEnabled(userId, transaction),
    transaction.memoryFact.findFirst({
      select: { statement: true },
      where: {
        ...callFactsWhere({ now, userId }),
        conversations: { some: { id: conversationId } },
      },
    }),
  ]);

  return enabled ? fact?.statement : undefined;
}
