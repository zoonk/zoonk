import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { lockUsageForViewer } from "../../../entitlements/_utils/usage-lock";
import { closeLiveCallConnection } from "../close-live-call-connection";
import {
  COMPLETION_REVIEW_LEASE_MS,
  hasCompletionReviewClaim,
  withCompletionReviewLease,
} from "./completion-review-lease";

/** The completion latch prevents a replacement from starting while feedback is being written. */
export async function closeCompletingConversation<T>({
  connectionId,
  conversationId,
  userId,
  review,
}: {
  connectionId: string;
  conversationId: string;
  userId: string;
  review: (completionStartedAt: Date) => Promise<T>;
}): Promise<
  T | { status: "previousConnectionClosing" | "conversationEnded" | "takenOver" | "notFound" }
> {
  if (!isUuid(connectionId)) {
    return { status: "notFound" };
  }

  const prepared = await prisma.$transaction(async (transaction) => {
    await lockUsageForViewer({ transaction, userId });

    const [origin, latest] = await Promise.all([
      transaction.liveCallConnection.findFirst({
        where: { conversationId, id: connectionId, userId },
      }),
      transaction.liveCallConnection.findFirst({
        orderBy: { generation: "desc" },
        where: { conversationId, userId },
      }),
    ]);

    if (!origin) {
      return { status: "notFound" as const };
    }

    if (origin.endReason === "takeover") {
      return { status: "takenOver" as const };
    }

    if (
      origin.endReason === "admin" ||
      latest?.id !== origin.id ||
      latest.generation !== origin.generation
    ) {
      return { status: "conversationEnded" as const };
    }

    const conversation = await transaction.languageConversation.findUniqueOrThrow({
      where: { id: conversationId },
    });

    const now = new Date();
    /** A takeover needs a distinct fencing token, even if the clock has moved backward. */
    const completionStartedAt = new Date(
      Math.max(now.getTime(), (conversation.completionStartedAt?.getTime() ?? 0) + 1),
    );

    const { count } = await transaction.languageConversation.updateMany({
      data: { completionStartedAt, updatedAt: now },
      where: {
        OR: [
          { completionStartedAt: null },
          { updatedAt: { lte: new Date(now.getTime() - COMPLETION_REVIEW_LEASE_MS) } },
        ],
        id: conversationId,
        status: "ready",
        userId,
      },
    });

    if (count === 0) {
      return { status: "previousConnectionClosing" as const };
    }

    return { completionStartedAt, latest: origin, status: "ready" as const };
  });

  if (prepared.status !== "ready") {
    return prepared;
  }

  return withCompletionReviewLease({
    completionStartedAt: prepared.completionStartedAt,
    conversationId,
    review: async () => {
      const latest = prepared.latest;

      const outcome = await closeLiveCallConnection({
        connectionId: latest.id,
        generation: latest.generation,
        reason: "completion",
      });

      if (outcome.status !== "closed") {
        return { status: "previousConnectionClosing" as const };
      }

      /** A concurrent takeover/admin close can confirm first while this close was awaiting the provider. */
      const refusal = await prisma.$transaction(async (transaction) => {
        await lockUsageForViewer({ transaction, userId });

        const current = await transaction.liveCallConnection.findUniqueOrThrow({
          where: { id: latest.id },
        });

        if (current.endReason === "takeover") {
          return { status: "takenOver" as const };
        }

        return current.endReason === "admin" ? { status: "conversationEnded" as const } : null;
      });

      if (refusal) {
        return refusal;
      }

      /** Provider close can outlive a paused worker's lease. Fence it before model work too. */
      const owned = await hasCompletionReviewClaim({
        completionStartedAt: prepared.completionStartedAt,
        conversationId,
      });

      return owned
        ? review(prepared.completionStartedAt)
        : { status: "previousConnectionClosing" as const };
    },
  });
}
