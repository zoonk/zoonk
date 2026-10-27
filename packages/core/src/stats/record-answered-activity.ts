import { writeLearnerChange } from "../learner/_utils/write-learner-change";
import { type ProgressChange } from "../sessions/_utils/session-progress";
import { type AnsweredActivity, settleAnsweredActivity } from "./_utils/settle-answered-activity";
import { getCompletionEnergyContext } from "./completion-energy";

/**
 * Adds a set of questions the learner answered outside lessons and sessions (a chapter's
 * test-out, a focus test, a language's level test) to their day: its answering time, its answers, the Energy answers give
 * and a row in the ledger, so Activity and Statistics count every minute they studied. It earns
 * no Brain Power: it tests what the learner knows rather than teaching it. Returns the Brain Power
 * and Energy before and after it, for its result to celebrate the Energy it reached.
 */
export async function recordAnsweredActivity(
  activity: AnsweredActivity,
): Promise<{ brainPower: ProgressChange; energy: ProgressChange }> {
  const { timeZone, userId } = activity;

  // Statistics and the day's totals show it, so it's a learner change.
  return writeLearnerChange({ userId }, async (tx) => {
    const lock = await getCompletionEnergyContext({ timeZone, transaction: tx, userId });
    return settleAnsweredActivity(tx, { ...activity, lock });
  });
}
