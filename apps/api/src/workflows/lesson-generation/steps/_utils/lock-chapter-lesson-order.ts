import { type TransactionClient } from "@zoonk/db";

/**
 * Uses the chapter row only as the mutex for inserting lessons into that
 * chapter's ordered list. No chapter data changes; concurrent split writers
 * serialize here before they reload positions and shift later lessons.
 */
export async function lockChapterLessonOrder({
  chapterId,
  transaction,
}: {
  chapterId: string;
  transaction: TransactionClient;
}): Promise<void> {
  await transaction.$queryRaw`SELECT "id" FROM "chapters" WHERE "id" = ${chapterId}::uuid FOR UPDATE`;
}
