import { type LiveCallConnection, type LiveCallEndReason, type TransactionClient } from "@zoonk/db";

/**
 * Ends an open connection once, under the learner's lock: the move from its current state to
 * `ended` is conditional, so of two enders racing only one changes anything. The row keeps the
 * authoritative cost; the free day moves by the difference from what it posted, and the learner's
 * usage record (gone with a deleted account, so the write then matches nothing) keeps the call
 * time and cost. Returns whether this call ended it.
 */
export async function settleLiveCall({
  connection,
  costMicros,
  endReason,
  learnerSeconds,
  now,
  transaction,
}: {
  connection: LiveCallConnection;
  costMicros: number;
  endReason: LiveCallEndReason;
  learnerSeconds: number;
  now: Date;
  transaction: TransactionClient;
}): Promise<boolean> {
  if (connection.state === "ended") {
    return false;
  }

  const { count } = await transaction.liveCallConnection.updateMany({
    data: {
      costMicros,
      endReason: connection.endReason ?? endReason,
      endedAt: now,
      state: "ended",
    },
    where: { id: connection.id, state: connection.state },
  });

  if (count === 0) {
    return false;
  }

  const delta = costMicros - connection.costMicros;

  await Promise.all([
    connection.freeSpendDay &&
      delta !== 0 &&
      transaction.freeCallSpendDay.update({
        data: { spentMicros: { increment: delta } },
        where: { day: connection.freeSpendDay },
      }),
    transaction.usageRecord.updateMany({
      data: { costMicros, seconds: learnerSeconds },
      where: { kind: "conversation", targetId: connection.id, userId: connection.userId },
    }),
  ]);

  return true;
}
