import { prisma } from "@zoonk/db";
import { endLiveCall } from "../end-live-call";
import { type LiveCallRefusal } from "../live-call-contract";

/**
 * Before a new reservation, the learner's open connection ends: a reservation always (it never
 * blocks), the same call's connection as a reconnect, and another call's only with `takeover`. A
 * creation in flight is told to hang up once its session exists, and the new call waits for it,
 * as it does for a hangup OpenAI didn't confirm, so two sessions never bill at once.
 */
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
