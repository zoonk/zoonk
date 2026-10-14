import "server-only";
import { type TransactionClient, sql } from "@zoonk/db";
import { STUDY_SESSION_INCLUDE, type StudySessionRow } from "./study-session-access";

const QUEUE_LOCK_NAMESPACE = 51_884;

/**
 * Serializes changes to a session's queue. Block transitions take their block before the session,
 * so queue writers use that order too. The advisory lock keeps another queue writer from adding
 * rows while these are locked. Reload everything after waiting, including the session's status.
 * Call this before writing the plan or goal the queue follows.
 */
export async function lockSessionQueue({
  sessionId,
  tx,
}: {
  sessionId: string;
  tx: TransactionClient;
}): Promise<StudySessionRow | null> {
  await tx.$queryRaw(
    sql`SELECT pg_advisory_xact_lock(${QUEUE_LOCK_NAMESPACE}::int, hashtext(${sessionId}))::text`,
  );

  await tx.$queryRaw`
    SELECT id FROM study_session_blocks
    WHERE session_id = ${sessionId}::uuid ORDER BY id FOR UPDATE
  `;

  await tx.$queryRaw`
    SELECT id FROM study_sessions WHERE id = ${sessionId}::uuid FOR NO KEY UPDATE
  `;

  return tx.studySession.findUnique({ include: STUDY_SESSION_INCLUDE, where: { id: sessionId } });
}
