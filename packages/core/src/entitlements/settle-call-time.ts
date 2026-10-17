import "server-only";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getAllowanceCacheTag } from "../cache/tags";
import { unchanged, writeLearnerChange } from "../learner/_utils/write-learner-change";
import { getCallSecondsRun } from "./_utils/call-time";
import { lockUsageForViewer } from "./_utils/usage-lock";
import { getEstimatedCostMicros } from "./limits";

/**
 * Once a live call ends, the day's call time keeps only what it ran (`getCallSecondsRun`): the
 * rest of what it held goes back to the learner. A call that never ends keeps all it held. Only
 * for a learner a public capability has authenticated.
 */
export async function settleCallTime({
  conversationId,
  now,
  userId,
}: {
  conversationId: string;
  now: Date;
  userId: string;
}): Promise<void> {
  const changed = await writeLearnerChange({ userId }, async (transaction) => {
    await lockUsageForViewer({ transaction, userId });
    /** Server connection settlement owns new calls; legacy records retain their original behavior. */
    const connection = await transaction.liveCallConnection.findFirst({
      where: { conversationId, userId },
    });

    if (connection) {
      return unchanged(false);
    }

    const record = await transaction.usageRecord.findUnique({
      where: { userUsageTarget: { kind: "conversation", targetId: conversationId, userId } },
    });

    if (!record) {
      return unchanged(false);
    }

    const seconds = getCallSecondsRun({ now, record });

    const costMicros = getEstimatedCostMicros({
      generated: record.generated,
      kind: record.kind,
      seconds,
    });

    if (seconds === record.seconds) {
      return unchanged(false);
    }

    await transaction.usageRecord.update({
      data: { costMicros, seconds },
      where: { id: record.id },
    });

    return true;
  });

  if (changed) {
    revalidateCacheTags([getAllowanceCacheTag(userId)]);
  }
}
