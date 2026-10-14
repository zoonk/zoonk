import { type LiveCallConnection, type TransactionClient } from "@zoonk/db";
import { getLiveCallCostMicros } from "../../../entitlements/limits";
import { getLiveCallLiability } from "./live-call-policy";

async function updateFreeDay({
  connection,
  delta,
  transaction,
}: {
  connection: LiveCallConnection;
  delta: number;
  transaction: TransactionClient;
}): Promise<void> {
  if (connection.freeSpendDay && delta !== 0) {
    await transaction.freeCallSpendDay.update({
      data: { spentMicros: { increment: delta } },
      where: { day: connection.freeSpendDay },
    });
  }
}

/** Ledger and original-day adjustment commit with slot release and learner-time settlement. */
async function closeLiveCallLedger({
  connection,
  costConfidence,
  now,
  seconds,
  settledMicros,
  transaction,
}: {
  connection: LiveCallConnection;
  costConfidence: LiveCallConnection["costConfidence"];
  now: Date;
  seconds: number | null;
  settledMicros: number;
  transaction: TransactionClient;
}): Promise<void> {
  await transaction.liveCallConnection.update({
    data: { closedAt: now, costConfidence, liabilityMicros: 0, settledMicros, state: "closed" },
    where: { id: connection.id },
  });

  await updateFreeDay({
    connection,
    delta: settledMicros - connection.liabilityMicros,
    transaction,
  });

  const released = await transaction.liveCallSlot.updateMany({
    data: { connectionId: null },
    where: {
      connectionId: connection.id,
      generation: connection.generation,
      userId: connection.userId,
    },
  });

  const ledger = await transaction.liveCallConnection.findMany({
    where: { conversationId: connection.conversationId, userId: connection.userId },
  });

  /**
   * Learner time settles with the slot. A connection that no longer holds it returned its time
   * when it first closed, and a newer call's hold on the same record must stay.
   */
  const learnerSeconds =
    connection.priorUsageSeconds +
    (seconds === null ? 0 : Math.min(connection.heldSeconds, Math.max(0, Math.ceil(seconds))));

  await transaction.usageRecord.updateMany({
    data: {
      costMicros: ledger.reduce(
        (total, entry) => total + getLiveCallLiability({ connection: entry, now }),
        0,
      ),
      ...(released.count > 0 ? { seconds: learnerSeconds } : {}),
    },
    where: { id: connection.usageRecordId },
  });
}

/** A provider receipt, or `null` seconds when no session ever ran, settles the confirmed cost. */
export async function settleLiveCall({
  connection,
  now,
  seconds,
  transaction,
}: {
  connection: LiveCallConnection;
  now: Date;
  seconds: number | null;
  transaction: TransactionClient;
}): Promise<void> {
  await closeLiveCallLedger({
    connection,
    costConfidence: "confirmed",
    now,
    seconds,
    settledMicros: seconds === null ? 0 : getLiveCallCostMicros(seconds),
    transaction,
  });
}

/**
 * No close can confirm the cost anymore, so the estimate stays charged in case the provider billed
 * it. `seconds` is the learner time to keep: none for a call they never had.
 */
export async function settleEstimatedLiveCall({
  connection,
  now,
  seconds,
  settledMicros,
  transaction,
}: {
  connection: LiveCallConnection;
  now: Date;
  seconds: number | null;
  settledMicros: number;
  transaction: TransactionClient;
}): Promise<void> {
  await closeLiveCallLedger({
    connection,
    costConfidence: "estimated",
    now,
    seconds,
    settledMicros,
    transaction,
  });
}

/**
 * Provider evidence for a row settled by estimate: the estimate is owed again as liability until
 * the receipt settles it, so the free day and usage move by the difference exactly once.
 */
export function reopenEstimatedLiveCall(connection: LiveCallConnection) {
  return {
    closedAt: null,
    costConfidence: "unconfirmed" as const,
    liabilityMicros: connection.settledMicros,
    settledMicros: 0,
    state: "closing" as const,
  };
}

export async function accrueLiveCallLiability({
  connection,
  now,
  transaction,
}: {
  connection: LiveCallConnection;
  now: Date;
  transaction: TransactionClient;
}): Promise<void> {
  const liabilityMicros = getLiveCallLiability({ connection, now });

  await transaction.liveCallConnection.update({
    data: { costConfidence: "unconfirmed", liabilityMicros },
    where: { id: connection.id },
  });

  await updateFreeDay({
    connection,
    delta: liabilityMicros - connection.liabilityMicros,
    transaction,
  });
}
