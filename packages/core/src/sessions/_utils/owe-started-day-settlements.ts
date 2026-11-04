import "server-only";
import { type StudySessionBlock, type TransactionClient } from "@zoonk/db";
import { oweFollowUps } from "../../follow-ups/owe-follow-ups";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";

/**
 * Call in the transaction that skips or removes blocks. Every started day it touches owes a
 * settlement, which completes the day if nothing is left open: a write taking the day's other blocks
 * at the same time isn't visible here, only under the day's lock. Each write's settlement is keyed by
 * a block it took, since the API drops a settlement whose key is already running.
 */
export async function oweStartedDaySettlements(
  tx: TransactionClient,
  removed: readonly Pick<StudySessionBlock, "id" | "sessionId">[],
): Promise<void> {
  if (removed.length === 0) {
    return;
  }

  const started = await tx.studySession.findMany({
    select: { goal: { select: { timezone: true } }, id: true, userId: true },
    where: {
      id: { in: removed.map((block) => block.sessionId) },
      startedAt: { not: null },
      status: "active",
    },
  });

  await Promise.all(
    started.map((session) =>
      oweFollowUps({
        db: tx,
        followUps: [
          {
            input: {
              removedBlockId: removed.find((block) => block.sessionId === session.id)?.id,
              sessionId: session.id,
              timeZone: getAnswerTimeZone({ goal: session.goal }),
            },
            kind: "settleSessionDay",
          },
        ],
        userId: session.userId,
      }),
    ),
  );
}
