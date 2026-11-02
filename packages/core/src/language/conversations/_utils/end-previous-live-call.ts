import { prisma } from "@zoonk/db";
import { endLiveCall } from "../end-live-call";
import { type LiveCallRefusal } from "../live-call-contract";

export async function endPreviousLiveCall({
  conversationId,
  takeover,
  userId,
}: {
  conversationId: string;
  takeover?: boolean;
  userId: string;
}): Promise<LiveCallRefusal | null> {
  const previous = await prisma.liveCallConnection.findFirst({
    where: { state: { not: "ended" }, userId },
  });

  if (!previous) {
    return null;
  }

  const sameCall = previous.conversationId === conversationId;

  if (previous.state !== "reserved" && !sameCall && !takeover) {
    return {
      connectionId: previous.id,
      conversationId: previous.conversationId,
      status: "callInProgress",
    };
  }

  const ended = await endLiveCall({
    connectionId: previous.id,
    reason: sameCall ? "reconnect" : "takeover",
  });

  return ended.status === "closing" ? { status: "previousConnectionClosing" } : null;
}
