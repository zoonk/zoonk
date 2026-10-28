import "server-only";
import { type LiveCallEndReason, prisma } from "@zoonk/db";
import { getSession } from "../../users/get-session";
import { endLiveCall } from "./end-live-call";

export type EndLanguageConversationConnectionResult =
  | { endReason: LiveCallEndReason | null; status: "closed" }
  | { status: "previousConnectionClosing" | "unauthorized" | "notFound" };

export async function endLanguageConversationConnection({
  connectionId,
  conversationId,
}: {
  connectionId: string;
  conversationId: string;
}): Promise<EndLanguageConversationConnectionResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const connection = await prisma.liveCallConnection.findFirst({
    where: { conversationId, id: connectionId, userId: session.user.id },
  });

  if (!connection) {
    return { status: "notFound" };
  }

  const outcome = await endLiveCall({ connectionId, reason: "learner" });

  if (outcome.status === "closing") {
    return { status: "previousConnectionClosing" };
  }

  const ended = await prisma.liveCallConnection.findUniqueOrThrow({ where: { id: connectionId } });
  return { endReason: ended.endReason, status: "closed" };
}
