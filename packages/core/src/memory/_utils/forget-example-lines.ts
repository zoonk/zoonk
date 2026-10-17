import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";

/**
 * A lesson's personal example lines are written from the facts the learner shares, so they can
 * quote one. When a fact is deleted, corrected or replaced, or memory is turned off, the learner's
 * lines go too: nothing written from a fact outlives it. Lessons write new lines from what the
 * learner shares now the next time they need one, as they would after any change to their facts.
 */
export async function forgetExampleLines({
  client = prisma,
  userId,
}: {
  client?: TransactionClient;
  userId: string;
}): Promise<void> {
  await client.stepExampleLine.deleteMany({ where: { userId } });
}
