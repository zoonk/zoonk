import "server-only";
import { type TransactionClient } from "@zoonk/db";

/** Serializes turn creation and generation claims for one lesson conversation. */
export async function lockLessonQuestionThread({
  threadId,
  transaction,
}: {
  threadId: string;
  transaction: TransactionClient;
}) {
  await transaction.$queryRaw`
    SELECT "id"
    FROM "lesson_question_threads"
    WHERE "id" = ${threadId}::uuid
    FOR UPDATE
  `;
}
