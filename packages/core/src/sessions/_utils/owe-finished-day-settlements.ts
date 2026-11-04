import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { oweFollowUps } from "../../follow-ups/owe-follow-ups";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";

/**
 * Call in the transaction that skips or removes blocks. A started day it leaves with nothing open
 * is finished, but only a settlement completes it.
 */
export async function oweFinishedDaySettlements(
  tx: TransactionClient,
  sessionIds: readonly string[],
): Promise<void> {
  if (sessionIds.length === 0) {
    return;
  }

  const finished = await tx.studySession.findMany({
    select: { goal: { select: { timezone: true } }, id: true, userId: true },
    where: {
      blocks: { none: { status: { in: ["active", "pending"] } } },
      id: { in: [...sessionIds] },
      status: "active",
    },
  });

  await Promise.all(
    finished.map((session) =>
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
