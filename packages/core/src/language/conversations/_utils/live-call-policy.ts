import { isLiveCallAvailable } from "@zoonk/ai/tasks/v2/language/live-call-session";
import { type TransactionClient } from "@zoonk/db";

export const LIVE_CALL_SETTING_ID = "live";

/**
 * The free day's budget when this learner may start a call now, or null when calls are paused for
 * them: Off, Staff for anyone but an admin, a missing setting or a missing OpenAI key. Mutation
 * preconditions read it fresh, never cached.
 */
export async function readLiveCallAdmission({
  transaction,
  userId,
}: {
  transaction: TransactionClient;
  userId: string;
}): Promise<number | null> {
  const [setting, user] = await Promise.all([
    transaction.liveCallSetting.findUnique({ where: { id: LIVE_CALL_SETTING_ID } }),
    transaction.user.findUnique({ where: { id: userId } }),
  ]);

  if (
    !setting ||
    !user ||
    !isLiveCallAvailable() ||
    !Number.isSafeInteger(setting.freeDailyBudgetMicros) ||
    setting.freeDailyBudgetMicros < 0
  ) {
    return null;
  }

  if (setting.admission === "all" || (setting.admission === "staff" && user.role === "admin")) {
    return setting.freeDailyBudgetMicros;
  }

  return null;
}
