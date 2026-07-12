import { type TransactionClient, prisma } from "@zoonk/db";

/**
 * Replaces one lesson's visible step batch while holding a lock on the lesson.
 * Workflow steps may execute concurrently during durable recovery, so the
 * parent-row lock keeps two replacements from deleting and inserting across
 * each other while still allowing unrelated lessons to save in parallel.
 */
export async function replaceLessonSteps({
  lessonId,
  saveSteps,
}: {
  lessonId: string;
  saveSteps: (transaction: TransactionClient) => Promise<void>;
}): Promise<void> {
  await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT "id" FROM "lessons" WHERE "id" = ${lessonId}::uuid FOR UPDATE`;
    await transaction.step.deleteMany({ where: { lessonId } });
    await saveSteps(transaction);
  });
}
