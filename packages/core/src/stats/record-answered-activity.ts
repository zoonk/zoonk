import { prisma } from "@zoonk/db";
import { type AnsweredActivity, settleAnsweredActivity } from "./_utils/settle-answered-activity";
import { getCompletionEnergyContext } from "./completion-energy";

/**
 * Adds a set of questions the learner answered outside lessons and sessions (a chapter's
 * test-out, a focus test, a language's level test) to their day: its answering time, its answers, the Energy answers give
 * and a row in the ledger, so Activity and Statistics count every minute they studied. It earns
 * no Brain Power: it tests what the learner knows rather than teaching it.
 */
export async function recordAnsweredActivity(activity: AnsweredActivity): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const { timeZone, userId } = activity;
    const lock = await getCompletionEnergyContext({ timeZone, transaction: tx, userId });
    await settleAnsweredActivity(tx, { ...activity, lock });
  });
}
