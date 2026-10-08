import "server-only";
import { prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getAllowanceCacheTag } from "../cache/tags";
import { getCallSecondsRun } from "./_utils/call-time";
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
  const record = await prisma.usageRecord.findUnique({
    where: { userUsageTarget: { kind: "conversation", targetId: conversationId, userId } },
  });

  if (!record) {
    return;
  }

  const seconds = getCallSecondsRun({ now, record });

  if (seconds === record.seconds) {
    return;
  }

  await prisma.usageRecord.update({
    data: {
      costMicros: getEstimatedCostMicros({
        generated: record.generated,
        kind: record.kind,
        seconds,
      }),
      seconds,
    },
    where: { id: record.id },
  });

  revalidateCacheTags([getAllowanceCacheTag(userId)]);
}
