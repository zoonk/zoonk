import { type LanguageConversation, type TransactionClient, sql } from "@zoonk/db";
import {
  getCallExposureMicros,
  getEndingCharge,
  getTalkEndsAt,
} from "../../language/conversations/_utils/live-call-money";
import { isPlusOnlyLiveCall } from "../../language/conversations/_utils/live-call-plus";
import { settleLiveCall } from "../../language/conversations/_utils/settle-live-call";
import {
  type LiveCallRefusal,
  type LiveCallReservationResult,
} from "../../language/conversations/live-call-contract";
import {
  LIVE_CALL_ATTEMPTS_PER_DAY,
  LIVE_CALL_WRAP_UP_SECONDS,
  getCallMonthlyBudgetMicros,
  getLiveCallReservationMicros,
} from "../limits";
import { claimUsageInTransaction } from "./claim-usage-in-transaction";
import { type EntitlementViewer } from "./entitlement-viewer";
import { getUsagePeriodStarts } from "./usage-periods";

const MS_PER_SECOND = 1000;

/** Must escape the transaction so a refused reservation rolls back its claimed call time. */
export class LiveCallReservationRefusedError extends Error {
  readonly result: LiveCallRefusal;
  constructor(result: LiveCallRefusal) {
    super(result.status);
    this.name = "LiveCallReservationRefusedError";
    this.result = result;
  }
}

/** A checkpoint keeps the talk time its first connection opened; other calls start over. */
async function requestedCallSeconds({
  conversation,
  now,
  transaction,
}: {
  conversation: LanguageConversation;
  now: Date;
  transaction: TransactionClient;
}): Promise<number> {
  const length = conversation.minutes * 60;

  if (conversation.kind !== "checkpoint") {
    return length;
  }

  const first = await transaction.liveCallConnection.findFirst({
    orderBy: { createdAt: "asc" },
    where: { conversationId: conversation.id },
  });

  if (!first) {
    return length;
  }

  return Math.max(0, Math.floor((getTalkEndsAt(first) - now.getTime()) / MS_PER_SECOND));
}

async function clearOpenConnection({
  conversationId,
  now,
  transaction,
  userId,
}: {
  conversationId: string;
  now: Date;
  transaction: TransactionClient;
  userId: string;
}): Promise<LiveCallRefusal | null> {
  const open = await transaction.liveCallConnection.findMany({
    where: { state: { not: "ended" }, userId },
  });

  const reservations = open.filter((connection) => connection.state === "reserved");
  const running = open.find((connection) => connection.state !== "reserved");

  await Promise.all(
    reservations.map((connection) =>
      settleLiveCall({
        connection,
        ...getEndingCharge({ connection, now }),
        endReason: connection.conversationId === conversationId ? "reconnect" : "takeover",
        now,
        transaction,
      }),
    ),
  );

  if (!running) {
    return null;
  }

  return running.state === "live" && running.conversationId !== conversationId
    ? { connectionId: running.id, conversationId: running.conversationId, status: "callInProgress" }
    : { status: "previousConnectionClosing" };
}

async function fitsMonthlyBudget({
  now,
  reservedMicros,
  transaction,
  viewer,
}: {
  now: Date;
  reservedMicros: number;
  transaction: TransactionClient;
  viewer: EntitlementViewer;
}): Promise<boolean> {
  const connections = await transaction.liveCallConnection.findMany({
    where: {
      OR: [{ createdAt: { gte: getUsagePeriodStarts(now).month } }, { state: { not: "ended" } }],
      userId: viewer.userId,
    },
  });

  const exposure = connections.reduce(
    (total, connection) => total + getCallExposureMicros({ connection, now }),
    0,
  );

  return exposure + reservedMicros <= getCallMonthlyBudgetMicros(viewer.tier);
}

async function newConnectionId(transaction: TransactionClient): Promise<string> {
  const [row] = await transaction.$queryRaw<{ id: string }[]>(sql`SELECT uuidv7()::text AS id`);

  if (!row) {
    throw new Error("PostgreSQL returned no id");
  }

  return row.id;
}

/** Caller must hold the learner's lock; reserves call time and spend atomically. */
export async function reserveLiveCall({
  conversationId,
  now,
  transaction,
  viewer,
}: {
  conversationId: string;
  now: Date;
  transaction: TransactionClient;
  viewer: EntitlementViewer;
}): Promise<LiveCallReservationResult> {
  const conversation = await transaction.languageConversation.findFirst({
    where: { id: conversationId, userId: viewer.userId },
  });

  if (!conversation) {
    return { status: "notFound" };
  }

  if (conversation.status !== "ready" || conversation.reviewRunId !== null) {
    return { status: "conversationEnded" };
  }

  if (isPlusOnlyLiveCall(conversation.kind) && viewer.tier !== "plus") {
    return { status: "plusRequired" };
  }

  const open = await clearOpenConnection({
    conversationId,
    now,
    transaction,
    userId: viewer.userId,
  });

  if (open) {
    return open;
  }

  const today = await transaction.liveCallConnection.count({
    where: { createdAt: { gte: getUsagePeriodStarts(now).day }, userId: viewer.userId },
  });

  if (today >= LIVE_CALL_ATTEMPTS_PER_DAY) {
    return { period: "day", status: "connectionLimitReached" };
  }

  const seconds = await requestedCallSeconds({ conversation, now, transaction });

  if (seconds === 0) {
    return { status: "conversationEnded" };
  }

  return holdCallTime({ conversation, now, seconds, transaction, viewer });
}

async function holdCallTime({
  conversation,
  now,
  seconds,
  transaction,
  viewer,
}: {
  conversation: LanguageConversation;
  now: Date;
  seconds: number;
  transaction: TransactionClient;
  viewer: EntitlementViewer;
}): Promise<LiveCallReservationResult> {
  const id = await newConnectionId(transaction);

  const { decision } = await claimUsageInTransaction({
    generated: false,
    kind: "conversation",
    now,
    seconds,
    targetId: id,
    transaction,
    viewer,
  });

  if (decision.status !== "allowed") {
    return decision;
  }

  const heldSeconds = decision.heldSeconds ?? seconds;

  if (heldSeconds === 0) {
    throw new LiveCallReservationRefusedError({ status: "conversationEnded" });
  }

  const costMicros = getLiveCallReservationMicros(heldSeconds);

  if (!(await fitsMonthlyBudget({ now, reservedMicros: costMicros, transaction, viewer }))) {
    throw new LiveCallReservationRefusedError({
      limit: {
        limit: getCallMonthlyBudgetMicros(viewer.tier),
        period: "month",
        resource: "aiSpend",
        tier: viewer.tier,
      },
      status: "limitReached",
    });
  }

  const connection = await transaction.liveCallConnection.create({
    data: {
      conversationId: conversation.id,
      costMicros,
      createdAt: now,
      deadlineAt: new Date(
        now.getTime() + (heldSeconds + LIVE_CALL_WRAP_UP_SECONDS) * MS_PER_SECOND,
      ),
      heldSeconds,
      id,
      userId: viewer.userId,
    },
  });

  return { connection, endsAtLimit: decision.shortenedBy ?? null, status: "reserved" };
}
