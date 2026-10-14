import { prisma } from "@zoonk/db";
import { lockUsageForViewer } from "../../../entitlements/_utils/usage-lock";
import { closeLiveCallConnection } from "../close-live-call-connection";
import { type LiveCallRefusal } from "../live-call-contract";

/** Replacement is refused until the old provider connection is authoritatively terminal. */
export async function endPreviousLiveCall({
  conversationId,
  requestId,
  takeover,
  userId,
}: {
  conversationId: string;
  requestId: string;
  takeover?: boolean;
  userId: string;
}): Promise<LiveCallRefusal | null> {
  const previous = await prisma.$transaction(async (transaction) => {
    await lockUsageForViewer({ transaction, userId });

    /** A delayed replay observes its own attempt; it must never close a newer slot occupant. */
    const existingRequest = await transaction.liveCallConnection.findUnique({
      where: { userId_requestId: { requestId, userId } },
    });

    if (existingRequest) {
      return null;
    }

    const slot = await transaction.liveCallSlot.findUnique({
      include: { connection: true },
      where: { userId },
    });

    return slot?.connection ?? null;
  });

  if (!previous || previous.requestId === requestId) {
    return null;
  }

  if (previous.conversationId !== conversationId && !takeover) {
    return {
      connectionId: previous.id,
      conversationId: previous.conversationId,
      status: "callInProgress",
    };
  }

  const closed = await closeLiveCallConnection({
    connectionId: previous.id,
    generation: previous.generation,
    reason: previous.conversationId === conversationId ? "reconnect" : "takeover",
  });

  return closed.status === "closed" ? null : { status: "previousConnectionClosing" };
}
