import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { finishLearningEvent, startLearningEvent } from "../../stats/record-learning-event";
import { BRAIN_POWER_BONUS } from "../brain-power";
import { type StudySessionRow } from "./study-session-access";

function sessionRowWhere({ sessionId, userId }: { sessionId: string; userId: string }) {
  return {
    contentIds: { equals: sessionId, path: ["studySessionId"] },
    kind: "session" as const,
    userId,
  };
}

/**
 * A session's ledger row is written when it starts, with `endedAt` null until it ends, so admin
 * completion rates count sessions that were started and never finished.
 */
export function recordSessionStart(
  tx: TransactionClient,
  { now, session, timeZone }: { now: Date; session: StudySessionRow; timeZone: string },
) {
  return startLearningEvent(tx, {
    brainPower: session.fullMealAt === null ? 0 : BRAIN_POWER_BONUS.fullMeal,
    contentIds: { studySessionId: session.id },
    goalId: session.goalId,
    kind: "session",
    startedAt: now,
    timeZone,
    titleSnapshot: session.goal?.title ?? null,
    userId: session.userId,
  });
}

/** Adds session-level Brain Power (the full meal) to the session's ledger row. */
export async function addSessionBrainPower(
  tx: TransactionClient,
  { brainPower, sessionId, userId }: { brainPower: number; sessionId: string; userId: string },
) {
  await tx.learningEvent.updateMany({
    data: { brainPower: { increment: brainPower } },
    where: sessionRowWhere({ sessionId, userId }),
  });
}

/**
 * The time a session took: the seconds its lessons and question blocks recorded as each finished,
 * which today's totals add up too, so the session's end, its ledger row and the learner's stats say
 * one number (Pedro's end said the plan's 31 minutes for 8 minutes of study).
 */
export async function sumSessionSeconds(
  client: Pick<TransactionClient, "learningEvent">,
  { sessionId, userId }: { sessionId: string; userId: string },
): Promise<number> {
  const { _sum } = await client.learningEvent.aggregate({
    _sum: { seconds: true },
    where: {
      contentIds: { equals: sessionId, path: ["studySessionId"] },
      kind: { not: "session" },
      userId,
    },
  });

  return _sum.seconds ?? 0;
}

/**
 * Closes the session's ledger row with its totals and the time it took, dated when it ended. It
 * keeps the Brain Power the row already holds (the full meal); ending a session twice keeps the
 * first ending.
 */
export async function recordSessionEnd(
  tx: TransactionClient,
  {
    endedAt,
    sessionId,
    timeZone,
    totals,
    userId,
  }: {
    endedAt: Date;
    sessionId: string;
    timeZone: string;
    totals: { correctAnswers: number; incorrectAnswers: number };
    userId: string;
  },
) {
  const row = await tx.learningEvent.findFirst({
    where: { ...sessionRowWhere({ sessionId, userId }), endedAt: null },
  });

  if (!row) {
    return;
  }

  const seconds = await sumSessionSeconds(tx, { sessionId, userId });

  await finishLearningEvent(tx, {
    endedAt,
    eventId: row.id,
    kind: "session",
    outcome: { ...totals, brainPower: row.brainPower, energyDelta: row.energyDelta, seconds },
    timeZone,
  });
}
