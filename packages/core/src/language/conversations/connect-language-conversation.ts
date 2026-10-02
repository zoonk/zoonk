import "server-only";
import { getLiveConversationVoice } from "@zoonk/ai/tasks/v2/language/live-conversation-models";
import { createLiveConversationToken } from "@zoonk/ai/tasks/v2/language/live-conversation-token";
import { prisma } from "@zoonk/db";
import { claimUsage } from "../../entitlements/claim-usage";
import { type UsageDecision } from "../../entitlements/contract";
import { getSession } from "../../users/get-session";
import { type LanguageConversationSetup } from "./conversation-contract";
import { findOwnedConversation } from "./get-language-conversation";

/**
 * A call lasts up to five minutes, so a dropped connection may reconnect for a while without
 * counting again. After that, the call is spent: reconnecting forever would make every call free.
 */
const RECONNECT_WINDOW_MS = 600_000;

export type ConnectLanguageConversationResult =
  | Exclude<UsageDecision, { status: "allowed" }>
  | { setup: LanguageConversationSetup; status: "ready" }
  | { status: "conversationEnded" }
  | { status: "notFound" };

async function isPastReconnectWindow({
  conversationId,
  userId,
}: {
  conversationId: string;
  userId: string;
}): Promise<boolean> {
  const claimed = await prisma.usageRecord.findUnique({
    where: { userUsageTarget: { kind: "conversation", targetId: conversationId, userId } },
  });

  return claimed !== null && Date.now() - claimed.createdAt.getTime() > RECONNECT_WINDOW_MS;
}

/**
 * Opens the call: the learner's plan is charged for one conversation (guests have none, free
 * learners a few a day; reconnecting soon after doesn't count again) and the app gets a
 * short-lived, single-use token for GPT-Live and the voice for the call's language. The call
 * itself runs between the browser and the model; our key never leaves the server.
 */
export async function connectLanguageConversation(
  conversationId: string,
): Promise<ConnectLanguageConversationResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;
  const owned = await findOwnedConversation({ conversationId, userId });

  if (!owned) {
    return { status: "notFound" };
  }

  if (owned.row.status !== "ready" || (await isPastReconnectWindow({ conversationId, userId }))) {
    return { status: "conversationEnded" };
  }

  const decision = await claimUsage({ kind: "conversation", targetId: conversationId });

  if (decision.status !== "allowed") {
    return decision;
  }

  const connection = await createLiveConversationToken();

  await prisma.languageConversation.updateMany({
    data: { startedAt: new Date() },
    where: { id: conversationId, startedAt: null },
  });

  return {
    setup: { ...connection, voice: getLiveConversationVoice(owned.row.targetLanguage) },
    status: "ready",
  };
}
