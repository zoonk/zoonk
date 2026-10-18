import "server-only";
import { prisma } from "@zoonk/db";
import { getSession } from "../../users/get-session";
import { closeLiveCallConnection } from "./close-live-call-connection";

export type EndLanguageConversationConnectionResult = {
  status: "closed" | "previousConnectionClosing" | "unauthorized" | "notFound";
};

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

  const outcome = await closeLiveCallConnection({
    connectionId,
    generation: connection.generation,
    reason: "completion",
  });

  return { status: outcome.status === "closed" ? "closed" : "previousConnectionClosing" };
}
