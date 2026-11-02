import "server-only";
import { type TransactionClient } from "@zoonk/db";

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
