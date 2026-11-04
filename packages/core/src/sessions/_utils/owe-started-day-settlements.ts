import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { oweFollowUps } from "../../follow-ups/owe-follow-ups";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";

/**
 * Call in the transaction that skips or removes blocks. Every started day it touches owes a
 * settlement, which completes the day if nothing is left open: a write taking the day's other blocks
 * at the same time isn't visible here, only under the day's lock.
 */
export async function oweStartedDaySettlements(
  tx: TransactionClient,
  sessionIds: readonly string[],
): Promise<void> {
  if (sessionIds.length === 0) {
    return;
  }

  const started = await tx.studySession.findMany({
    select: { goal: { select: { timezone: true } }, id: true, userId: true },
    where: { id: { in: [...sessionIds] }, startedAt: { not: null }, status: "active" },
  });

  await Promise.all(
    started.map((session) =>
      oweFollowUps({
        db: tx,
        followUps: [
          {
            input: { sessionId: session.id, timeZone: getAnswerTimeZone({ goal: session.goal }) },
            kind: "settleSessionDay",
          },
        ],
        userId: session.userId,
      }),
    ),
  );
}
