import "server-only";
import { type ExperienceMode, type TransactionClient, prisma } from "@zoonk/db";
import { finishLearningEvent, startLearningEvent } from "../../stats/record-learning-event";
import { type StudySessionRow } from "./study-session-access";

/** The mode the learner studies in, so the ledger can compare Focus and Fun. */
export async function getLearnerMode(userId: string): Promise<ExperienceMode | null> {
  const profile = await prisma.userLearningProfile.findUnique({
    select: { experienceMode: true },
    where: { userId },
  });

  return profile?.experienceMode ?? null;
}

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
  {
    mode,
    now,
    session,
    timeZone,
  }: { mode: ExperienceMode | null; now: Date; session: StudySessionRow; timeZone: string },
) {
  return startLearningEvent(tx, {
    contentIds: { studySessionId: session.id },
    goalId: session.goalId,
    kind: "session",
    mode,
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
 * Closes the session's ledger row with its totals, dated when it ended. It keeps the Brain Power
 * the row already holds (the full meal); ending a session twice keeps the first ending.
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
    totals: { correctAnswers: number; incorrectAnswers: number; seconds: number };
    userId: string;
  },
) {
  const row = await tx.learningEvent.findFirst({
    where: { ...sessionRowWhere({ sessionId, userId }), endedAt: null },
  });

  if (!row) {
    return;
  }

  await finishLearningEvent(tx, {
    endedAt,
    eventId: row.id,
    kind: "session",
    outcome: { ...totals, brainPower: row.brainPower, energyDelta: row.energyDelta },
    timeZone,
  });
}
