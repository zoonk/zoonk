import { writeLearnerChange } from "../learner/_utils/write-learner-change";
import { type ProgressChange } from "../sessions/_utils/session-progress";
import { type AnsweredActivity, settleAnsweredActivity } from "./_utils/settle-answered-activity";
import { getCompletionEnergyContext } from "./completion-energy";

/** Records testing time and Energy without Brain Power, since it measures knowledge rather than teaching. */
export async function recordAnsweredActivity(
  activity: AnsweredActivity,
): Promise<{ brainPower: ProgressChange; energy: ProgressChange }> {
  const { timeZone, userId } = activity;

  return writeLearnerChange({ userId }, async (tx) => {
    const lock = await getCompletionEnergyContext({ timeZone, transaction: tx, userId });
    return settleAnsweredActivity(tx, { ...activity, lock });
  });
}
