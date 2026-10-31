import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { type StudySessionRow } from "./study-session-access";

/** Call after locking the learner but before writing plan/goal changes; reload state after waiting for block-then-session locks. */
export async function lockSessionQueue({
  sessionId,
  tx,
}: {
  sessionId: string;
  tx: TransactionClient;
}): Promise<StudySessionRow | null> {
  await tx.$queryRaw`
    SELECT id FROM study_session_blocks
    WHERE session_id = ${sessionId}::uuid ORDER BY id FOR UPDATE
  `;

  await tx.$queryRaw`
    SELECT id FROM study_sessions WHERE id = ${sessionId}::uuid FOR NO KEY UPDATE
  `;

  const session = await tx.studySession.findUnique({
    include: { blocks: { orderBy: { position: "asc" } } },
    where: { id: sessionId },
  });

  if (!session) {
    return null;
  }

  const goal = session.goalId ? await tx.goal.findUnique({ where: { id: session.goalId } }) : null;

  return { ...session, goal };
}
