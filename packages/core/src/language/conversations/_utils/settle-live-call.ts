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

  await transaction.liveCallSlot.updateMany({
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

  await transaction.usageRecord.updateMany({
    data: {
      costMicros: ledger.reduce(
        (total, entry) => total + getLiveCallLiability({ connection: entry, now }),
        0,
      ),
      seconds:
        connection.priorUsageSeconds +
        (seconds === null ? 0 : Math.min(connection.heldSeconds, Math.max(0, Math.ceil(seconds)))),
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
 * No receipt can ever come for a session without a provider ID: the learner never had the call, so
 * their time returns, while its estimated cost stays charged in case the provider billed it.
 */
export async function settleUnconfirmableLiveCall({
  connection,
  now,
  transaction,
}: {
  connection: LiveCallConnection;
  now: Date;
  transaction: TransactionClient;
}): Promise<void> {
  await closeLiveCallLedger({
    connection,
    costConfidence: "estimated",
    now,
    seconds: null,
    settledMicros: getLiveCallLiability({ connection, now }),
    transaction,
  });
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
