import { lockUsageForViewer } from "../../entitlements/_utils/usage-lock";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";

export type ReviewClaim =
  | { status: "owner" }
  | { runId: string; status: "joined" }
  | { status: "settled" }
  | { status: "conversationEnded" | "notFound" | "takenOver" };

export async function claimConversationReview({
  connectionId,
  conversationId,
  replaces,
  runId,
  userId,
}: {
  connectionId: string;
  conversationId: string;
  replaces?: string;
  runId: string;
  userId: string;
}): Promise<ReviewClaim> {
  return writeLearnerChange<ReviewClaim>({ userId }, async (transaction) => {
    await lockUsageForViewer({ transaction, userId });

    const [conversation, latest] = await Promise.all([
      transaction.languageConversation.findFirst({ where: { id: conversationId, userId } }),
      transaction.liveCallConnection.findFirst({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        where: { conversationId, userId },
      }),
    ]);

    if (!conversation) {
      return unchanged({ status: "notFound" as const });
    }

    if (conversation.status === "completed") {
      return unchanged({ status: "settled" as const });
    }

    if (conversation.reviewRunId === runId) {
      return unchanged({ status: "owner" as const });
    }

    if (latest?.id !== connectionId) {
      return unchanged({ status: "conversationEnded" as const });
    }

    if (latest.endReason === "takeover") {
      return unchanged({ status: "takenOver" as const });
    }

    if (conversation.reviewRunId !== null && conversation.reviewRunId !== replaces) {
      return unchanged({ runId: conversation.reviewRunId, status: "joined" as const });
    }

    await transaction.languageConversation.update({
      data: { reviewRunId: runId },
      where: { id: conversationId },
    });

    return { status: "owner" as const };
  });
}
