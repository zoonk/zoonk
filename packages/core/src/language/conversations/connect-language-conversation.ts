import "server-only";
import { getLiveConversationVoice } from "@zoonk/ai/tasks/v2/language/live-conversation-models";
import { createLiveConversationToken } from "@zoonk/ai/tasks/v2/language/live-conversation-token";
import { prisma } from "@zoonk/db";
import { claimUsage } from "../../entitlements/claim-usage";
import { type UsageDecision } from "../../entitlements/contract";
import { getSession } from "../../users/get-session";
import { type LanguageConversationSetup } from "./conversation-contract";
import { findOwnedConversation } from "./get-language-conversation";

const SECONDS_PER_MINUTE = 60;

export type ConnectLanguageConversationResult =
  | Exclude<UsageDecision, { status: "allowed" }>
  | { setup: LanguageConversationSetup; status: "ready" }
  | { status: "conversationEnded" }
  | { status: "notFound" };

/**
 * Opens the call: each connection holds the call's length from the call time on the learner's plan,
 * today's and this month's (guests have none; with less left, it holds what's left and the call
 * ends early, and with under a minute left, calls wait for the next day or month), and the app gets
 * a short-lived, single-use token for GPT-Live, the voice for the call's language and how long the
 * call may run.
 * Calling again after a drop starts the call over: what the dropped connection ran stays counted.
 * A call claimed on an earlier day can't connect again. The call itself runs between the browser
 * and the model; our key never leaves the server.
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

  if (owned.row.status !== "ready") {
    return { status: "conversationEnded" };
  }

  const callSeconds = owned.row.minutes * SECONDS_PER_MINUTE;

  const decision = await claimUsage({
    kind: "conversation",
    seconds: callSeconds,
    targetId: conversationId,
  });

  if (decision.status !== "allowed") {
    return decision;
  }

  const seconds = decision.heldSeconds ?? callSeconds;

  if (seconds === 0) {
    return { status: "conversationEnded" };
  }

  const connection = await createLiveConversationToken();

  await prisma.languageConversation.updateMany({
    data: { startedAt: new Date() },
    where: { id: conversationId, startedAt: null },
  });

  return {
    setup: {
      ...connection,
      endsAtLimit: decision.shortenedBy ?? null,
      seconds,
      voice: getLiveConversationVoice(owned.row.targetLanguage),
    },
    status: "ready",
  };
}
