import "server-only";
import { closeLiveCallSession } from "@zoonk/ai/tasks/v2/language/live-call-session";
import { recordLiveConversationUsage } from "@zoonk/ai/tasks/v2/language/live-conversation-usage";
import { type LiveCallEndReason, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getAllowanceCacheTag } from "../../cache/tags";
import { lockUsageForViewer } from "../../entitlements/_utils/usage-lock";
import { LIVE_CALL_INITIALIZATION_SECONDS } from "../../entitlements/limits";
import { canSettleWithoutProvider, getLiveCallLiability } from "./_utils/live-call-policy";
import {
  accrueLiveCallLiability,
  settleEstimatedLiveCall,
  settleLiveCall,
} from "./_utils/settle-live-call";
import { type CloseLiveCallResult } from "./live-call-contract";

/** Trusted workflow/system boundary; callers must never choose a learner's current slot. */
export async function closeLiveCallConnection({
  connectionId,
  generation,
  reason = "deadline",
}: {
  connectionId: string;
  generation: number;
  reason?: LiveCallEndReason;
}): Promise<CloseLiveCallResult> {
  const original = await prisma.liveCallConnection.findUnique({ where: { id: connectionId } });

  if (!original) {
    return { status: "notFound" };
  }

  const prepared = await prisma.$transaction(async (transaction) => {
    await lockUsageForViewer({ transaction, userId: original.userId });

    const connection = await transaction.liveCallConnection.findUniqueOrThrow({
      where: { id: connectionId },
    });

    if (connection.generation !== generation) {
      return { status: "stale" as const };
    }

    if (connection.state === "closed") {
      return { status: "closed" as const };
    }

    const now = new Date();

    if (connection.state === "pending") {
      await transaction.liveCallConnection.update({
        data: { endReason: reason },
        where: { id: connectionId },
      });

      await settleLiveCall({ connection, now, seconds: null, transaction });
      return { status: "closed" as const };
    }

    await transaction.liveCallConnection.update({
      data: {
        closeAttempts: { increment: 1 },
        endReason:
          reason === "takeover" || reason === "admin" ? reason : (connection.endReason ?? reason),
        lastCloseAt: now,
        state: "closing",
      },
      where: { id: connectionId },
    });

    if (canSettleWithoutProvider({ connection, now })) {
      await settleEstimatedLiveCall({
        connection,
        now,
        settledMicros: getLiveCallLiability({ connection, now }),
        transaction,
      });

      return { status: "closed" as const };
    }

    await accrueLiveCallLiability({ connection, now, transaction });
    return { connection, status: "prepared" as const };
  });

  if (prepared.status !== "prepared") {
    revalidateCacheTags([getAllowanceCacheTag(original.userId)]);
    return prepared;
  }

  const { connection } = prepared;
  const { providerSessionId } = connection;

  if (!providerSessionId) {
    return { status: "closing" };
  }

  const result = await safeAsync(() => closeLiveCallSession(providerSessionId));

  const outcome = await prisma.$transaction(async (transaction) => {
    await lockUsageForViewer({ transaction, userId: connection.userId });

    const current = await transaction.liveCallConnection.findUniqueOrThrow({
      where: { id: connectionId },
    });

    if (current.generation !== generation) {
      return { status: "stale" as const };
    }

    if (current.state === "closed") {
      return { status: "closed" as const };
    }

    const now = new Date();

    if (
      result.data?.status === "closed" &&
      Number.isFinite(result.data.seconds) &&
      result.data.seconds >= 0
    ) {
      await settleLiveCall({ connection: current, now, seconds: result.data.seconds, transaction });

      return {
        confirmedSeconds: Math.max(LIVE_CALL_INITIALIZATION_SECONDS, result.data.seconds),
        status: "closed" as const,
      };
    }

    await accrueLiveCallLiability({ connection: current, now, transaction });
    return { status: "closing" as const };
  });

  revalidateCacheTags([getAllowanceCacheTag(connection.userId)]);

  if (typeof outcome.confirmedSeconds === "number") {
    await recordLiveConversationUsage({
      analytics: { contentScope: "personal", distinctId: connection.userId },
      runId: connection.id,
      seconds: outcome.confirmedSeconds,
    });
  }

  return { status: outcome.status };
}
