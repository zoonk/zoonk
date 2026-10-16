import "server-only";
import { type TransactionClient } from "@zoonk/db";

/**
 * Locks the lessons and skills a content write changes, so a plan reading them waits for the
 * write to commit. Lessons first, then skills, each in id order, so two writers wait for each
 * other instead of deadlocking. The lock is the one a key-preserving update takes, so rows that
 * only reference them (answers, items) still insert.
 */
export async function lockSourceRoots(
  tx: TransactionClient,
  { lessonIds, skillIds }: { lessonIds: readonly string[]; skillIds: readonly string[] },
): Promise<void> {
  if (lessonIds.length > 0) {
    await tx.$queryRaw`
      SELECT id FROM library_lessons WHERE id = ANY(${[...lessonIds]}::uuid[])
      ORDER BY id FOR NO KEY UPDATE
    `;
  }

  if (skillIds.length > 0) {
    await tx.$queryRaw`
      SELECT id FROM skills WHERE id = ANY(${[...skillIds]}::uuid[])
      ORDER BY id FOR NO KEY UPDATE
    `;
  }
}

/**
 * Locks an exam's own row before a write of what plans read from it (its graph, its structure),
 * so a plan reading the exam waits for the write to commit, as with lessons and skills.
 */
export async function lockSourceBlueprint(
  tx: TransactionClient,
  blueprintId: string,
): Promise<void> {
  await tx.$queryRaw`SELECT id FROM exam_blueprints WHERE id = ${blueprintId}::uuid FOR NO KEY UPDATE`;
}
