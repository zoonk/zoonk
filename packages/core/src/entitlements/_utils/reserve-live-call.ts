import {
  type LanguageConversation,
  type LiveCallConnection,
  type LiveCallSlot,
  type TransactionClient,
} from "@zoonk/db";
import { isPlusOnlyLiveCall } from "../../language/conversations/_utils/live-call-plus";
import {
  getLiveCallLiability,
  isLiveCallCleanupHealthy,
  readLiveCallAdmission,
} from "../../language/conversations/_utils/live-call-policy";
import {
  type LiveCallRefusal,
  type LiveCallReservationResult,
} from "../../language/conversations/live-call-contract";
import {
  LIVE_CALL_ATTEMPTS_PER_CONVERSATION,
  LIVE_CALL_ATTEMPTS_PER_DAY,
  LIVE_CALL_GRACE_SECONDS,
  getCallMonthlyBudgetMicros,
  getLiveCallReservationMicros,
} from "../limits";
import { claimLiveCallTime } from "./claim-live-call-time";
import { type EntitlementViewer } from "./entitlement-viewer";
import { claimFreeCallSpend } from "./free-call-spend";
import { getUsagePeriodStarts } from "./usage-periods";

/** Refusals after a minute claim must roll back the entire reservation, including free-day writes. */
export class LiveCallReservationRefusedError extends Error {
  readonly result: LiveCallRefusal;
  constructor(result: LiveCallRefusal) {
    super(result.status);
    this.name = "LiveCallReservationRefusedError";
    this.result = result;
  }
}

async function requestedCallSeconds({
  conversation,
  now,
  transaction,
}: {
  conversation: { id: string; kind: string; minutes: number };
  now: Date;
  transaction: TransactionClient;
}): Promise<number> {
  if (conversation.kind !== "checkpoint") {
    return conversation.minutes * 60;
  }

  const first = await transaction.liveCallConnection.findFirst({
    orderBy: { createdAt: "asc" },
    where: { conversationId: conversation.id },
  });

  return first
    ? Math.max(
        0,
        Math.ceil((first.deadlineAt.getTime() - now.getTime()) / 1000) - LIVE_CALL_GRACE_SECONDS,
      )
    : conversation.minutes * 60;
}

export async function reserveLiveCall({
  conversationId,
  now,
  requestId,
  transaction,
  viewer,
}: {
  conversationId: string;
  now: Date;
  requestId: string;
  transaction: TransactionClient;
  viewer: EntitlementViewer;
}): Promise<LiveCallReservationResult> {
  const conversation = await transaction.languageConversation.findFirst({
    where: { id: conversationId, userId: viewer.userId },
  });

  if (!conversation) {
    return { status: "notFound" };
  }

  if (conversation.status !== "ready" || conversation.completionStartedAt !== null) {
    return { status: "conversationEnded" };
  }

  if (isPlusOnlyLiveCall(conversation.kind) && viewer.tier !== "plus") {
    return { status: "plusRequired" };
  }

  const budget = await readLiveCallAdmission({ transaction, userId: viewer.userId });

  if (budget === null || !(await isLiveCallCleanupHealthy({ now, transaction }))) {
    return { status: "callsPaused" };
  }

  const existing = await transaction.liveCallConnection.findUnique({
    where: { userId_requestId: { requestId, userId: viewer.userId } },
  });

  if (existing) {
    return existing.conversationId === conversationId && existing.state === "pending"
      ? { connection: existing, endsAtLimit: existing.shortenedBy, status: "reserved" }
      : { status: "previousConnectionClosing" };
  }

  const slot = await transaction.liveCallSlot.upsert({
    create: { userId: viewer.userId },
    update: {},
    where: { userId: viewer.userId },
  });

  if (slot.connectionId) {
    const previous = await transaction.liveCallConnection.findUniqueOrThrow({
      where: { id: slot.connectionId },
    });

    return previous.conversationId === conversationId
      ? { status: "previousConnectionClosing" }
      : {
          connectionId: previous.id,
          conversationId: previous.conversationId,
          status: "callInProgress",
        };
  }

  const starts = getUsagePeriodStarts(now);

  const [attempts, today, ledger] = await Promise.all([
    transaction.liveCallConnection.count({ where: { conversationId, userId: viewer.userId } }),
    transaction.liveCallConnection.count({
      where: { createdAt: { gte: starts.day }, userId: viewer.userId },
    }),
    transaction.liveCallConnection.findMany({
      where: {
        OR: [{ createdAt: { gte: starts.month } }, { state: { not: "closed" } }],
        userId: viewer.userId,
      },
    }),
  ]);

  if (attempts >= LIVE_CALL_ATTEMPTS_PER_CONVERSATION) {
    return { period: "conversation", status: "connectionLimitReached" };
  }

  if (today >= LIVE_CALL_ATTEMPTS_PER_DAY) {
    return { period: "day", status: "connectionLimitReached" };
  }

  return reserveCallLedger({
    attempts,
    budget,
    conversation,
    ledger,
    now,
    requestId,
    slot,
    transaction,
    viewer,
  });
}

async function reserveCallLedger({
  attempts,
  budget,
  conversation,
  ledger,
  now,
  requestId,
  slot,
  transaction,
  viewer,
}: {
  attempts: number;
  budget: number;
  conversation: LanguageConversation;
  ledger: LiveCallConnection[];
  now: Date;
  requestId: string;
  slot: LiveCallSlot;
  transaction: TransactionClient;
  viewer: EntitlementViewer;
}): Promise<LiveCallReservationResult> {
  const conversationId = conversation.id;
  const starts = getUsagePeriodStarts(now);
  const seconds = await requestedCallSeconds({ conversation, now, transaction });

  if (seconds === 0) {
    return { status: "conversationEnded" };
  }

  const decision = await claimLiveCallTime({ conversationId, now, seconds, transaction, viewer });

  if (decision.status !== "allowed") {
    throw new LiveCallReservationRefusedError(decision);
  }

  const heldSeconds = decision.heldSeconds ?? seconds;

  if (heldSeconds === 0) {
    throw new LiveCallReservationRefusedError({ status: "conversationEnded" });
  }

  const reservedMicros = getLiveCallReservationMicros(heldSeconds);
  const monthlyBudget = getCallMonthlyBudgetMicros(viewer.tier);

  const liability = ledger.reduce(
    (total, connection) => total + getLiveCallLiability({ connection, now }),
    0,
  );

  if (liability + reservedMicros > monthlyBudget) {
    throw new LiveCallReservationRefusedError({
      limit: { limit: monthlyBudget, period: "month", resource: "aiSpend", tier: viewer.tier },
      status: "limitReached",
    });
  }

  const freeSpendDay = viewer.tier === "free" ? starts.day : null;

  if (
    freeSpendDay &&
    !(await claimFreeCallSpend({
      budgetMicros: budget,
      costMicros: reservedMicros,
      day: freeSpendDay,
      transaction,
    }))
  ) {
    throw new LiveCallReservationRefusedError({
      limit: { limit: budget, period: "day", resource: "aiSpend", tier: viewer.tier },
      status: "limitReached",
    });
  }

  const usage = await transaction.usageRecord.findUniqueOrThrow({
    where: {
      userUsageTarget: { kind: "conversation", targetId: conversationId, userId: viewer.userId },
    },
  });

  const generation = slot.generation + 1;

  const connection = await transaction.liveCallConnection.create({
    data: {
      attemptNumber: attempts + 1,
      conversationId,
      createdAt: now,
      deadlineAt: new Date(now.getTime() + (heldSeconds + LIVE_CALL_GRACE_SECONDS) * 1000),
      freeSpendDay,
      generation,
      heldSeconds,
      liabilityMicros: reservedMicros,
      priorUsageSeconds: decision.priorUsageSeconds ?? 0,
      requestId,
      reservedMicros,
      shortenedBy: decision.shortenedBy ?? null,
      usageRecordId: usage.id,
      userId: viewer.userId,
    },
  });

  await transaction.liveCallSlot.update({
    data: { connectionId: connection.id, generation },
    where: { userId: viewer.userId },
  });

  return { connection, endsAtLimit: decision.shortenedBy ?? null, status: "reserved" };
}
