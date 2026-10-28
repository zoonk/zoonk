import { type LiveCallConnection, type LiveCallEndReason, type TransactionClient } from "@zoonk/db";

/** Requires the learner's lock; returns whether this caller changed the connection to ended. */
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
