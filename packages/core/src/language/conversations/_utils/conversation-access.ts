import "server-only";
import { hasActiveSubscription } from "../../../auth/subscription";
import { type LanguageConversationView } from "../conversation-contract";
import { isPlusOnlyLiveCall } from "./live-call-plus";

/** Reads and completion responses show the same Plus access, without hiding completed feedback. */
export async function withConversationAccess(conversation: LanguageConversationView | null) {
  if (!conversation) {
    return null;
  }

  const locked =
    isPlusOnlyLiveCall(conversation.kind) &&
    (conversation.status === "ready" || conversation.kind === "checkpoint") &&
    !(await hasActiveSubscription());

  return { ...conversation, locked };
}
