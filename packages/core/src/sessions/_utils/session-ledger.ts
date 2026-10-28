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

/** Record at start with endedAt unset so completion rates include abandoned sessions. */
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

export async function addSessionBrainPower(
  tx: TransactionClient,
  { brainPower, sessionId, userId }: { brainPower: number; sessionId: string; userId: string },
) {
  await tx.learningEvent.updateMany({
    data: { brainPower: { increment: brainPower } },
    where: sessionRowWhere({ sessionId, userId }),
  });
}

/** Use recorded block seconds so session totals, ledger entries, and learner stats agree. */
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

/** Closes with recorded totals while preserving existing Brain Power; duplicate endings keep the first ending. */
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
