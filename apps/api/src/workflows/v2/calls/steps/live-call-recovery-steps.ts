import {
  markLiveCallRecoveryUnconfirmed,
  recoverLiveCallConnection,
  recoverLiveCalls,
} from "@zoonk/core/language/conversations/recover";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";

type ConnectionFence = { connectionId: string; generation: number };

export async function recoverLiveCallStep(input: ConnectionFence) {
  "use step";

  const result = await safeAsync(() => recoverLiveCallConnection(input));

  if (result.error) {
    logError("[Live Call Deadline] Close attempt failed", result.error);
    return { status: "closing" as const };
  }

  return result.data;
}

/** Backoff belongs to the workflow rather than the SDK's immediate step retry loop. */
recoverLiveCallStep.maxRetries = 0;

export async function markLiveCallUnconfirmedStep(input: ConnectionFence) {
  "use step";
  await markLiveCallRecoveryUnconfirmed(input);
}

/** The existing daily sweep is the last resort for overdue or failed deadline runs. */
export async function recoverOverdueLiveCallsStep() {
  "use step";
  return recoverLiveCalls({ limit: 100 });
}
