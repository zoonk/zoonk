import { prisma } from "@zoonk/db";
import { logError } from "@zoonk/utils/logger";

/** The latch stays set to prevent reconnects; updatedAt is the renewable review lease. */
export const COMPLETION_REVIEW_LEASE_MS = 10 * 60 * 1000;
const RENEW_INTERVAL_MS = 30 * 1000;

export async function withCompletionReviewLease<T>({
  completionStartedAt,
  conversationId,
  review,
}: {
  completionStartedAt: Date;
  conversationId: string;
  review: () => Promise<T>;
}): Promise<T> {
  const where = { completionStartedAt, id: conversationId, status: "ready" as const };
  const renewal = { pending: Promise.resolve() };

  const timer = setInterval(() => {
    renewal.pending = renewal.pending
      .then(async () => {
        const { count } = await prisma.languageConversation.updateMany({
          data: { updatedAt: new Date() },
          where: { ...where, updatedAt: { gt: new Date(Date.now() - COMPLETION_REVIEW_LEASE_MS) } },
        });

        if (count === 0) {
          clearInterval(timer);
        }
      })
      .catch((error: unknown) => {
        logError("Conversation review lease renewal failed", error);
      });
  }, RENEW_INTERVAL_MS);

  timer.unref();

  try {
    return await review();
  } finally {
    clearInterval(timer);
    await renewal.pending;
    /** Failed/uncertain closes can retry immediately, without reopening the conversation. */
    await prisma.languageConversation.updateMany({
      data: { updatedAt: new Date(Date.now() - COMPLETION_REVIEW_LEASE_MS) },
      where,
    });
  }
}

export async function hasCompletionReviewClaim({
  completionStartedAt,
  conversationId,
}: {
  completionStartedAt: Date;
  conversationId: string;
}): Promise<boolean> {
  const { count } = await prisma.languageConversation.updateMany({
    data: { updatedAt: new Date() },
    where: {
      completionStartedAt,
      id: conversationId,
      status: "ready",
      updatedAt: { gt: new Date(Date.now() - COMPLETION_REVIEW_LEASE_MS) },
    },
  });

  return count === 1;
}
