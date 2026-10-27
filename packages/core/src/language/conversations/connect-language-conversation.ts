import "server-only";
import { getLiveConversationVoice } from "@zoonk/ai/tasks/v2/language/live-conversation-models";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getAllowanceCacheTag } from "../../cache/tags";
import { claimLiveCallUsageForViewer } from "../../entitlements/_utils/claim-usage-for-viewer";
import { getEntitlementViewer } from "../../entitlements/_utils/entitlement-viewer";
import { type StartStudyBlockResult, startStudyBlock } from "../../sessions/start-study-block";
import { endPreviousLiveCall } from "./_utils/end-previous-live-call";
import { isPlusOnlyLiveCall } from "./_utils/live-call-plus";
import { readLiveCallAdmission } from "./_utils/live-call-policy";
import {
  type LanguageConversationConnectInput,
  type LanguageConversationSetup,
} from "./conversation-contract";
import { endLiveCall } from "./end-live-call";
import { findOwnedConversation } from "./get-language-conversation";
import { type LiveCallDeadlineScheduler, type LiveCallRefusal } from "./live-call-contract";

const MS_PER_SECOND = 1000;

export type ConnectLanguageConversationResult =
  | LiveCallRefusal
  | Exclude<StartStudyBlockResult, { status: "ready" }>
  | { setup: LanguageConversationSetup; status: "ready" };

async function startCheckpointBlock(
  studyBlockId: string | null,
): Promise<Exclude<StartStudyBlockResult, { status: "ready" }> | null> {
  if (!studyBlockId) {
    return null;
  }

  const block = await prisma.studySessionBlock.findUnique({ where: { id: studyBlockId } });

  if (!block) {
    return { status: "notFound" };
  }

  const started = await startStudyBlock({
    blockId: studyBlockId,
    input: {},
    sessionId: block.sessionId,
  });

  return started.status === "ready" ? null : started;
}

/**
 * Reserves one connection of the learner's call: its time and cost are held, and its deadline run
 * starts before the answer, so the server hangs it up on time. A learner's open connection ends
 * first (`endPreviousLiveCall`). A deadline run that can't start ends the reservation at once.
 * `seconds` is the time left until the deadline when the server answered, so the browser's timer
 * doesn't depend on its clock.
 */
export async function connectLanguageConversation({
  conversationId,
  input = {},
  scheduleDeadline,
}: {
  conversationId: string;
  input?: LanguageConversationConnectInput;
  scheduleDeadline: LiveCallDeadlineScheduler;
}): Promise<ConnectLanguageConversationResult> {
  const viewer = await getEntitlementViewer();

  if (!viewer) {
    return { status: "unauthorized" };
  }

  const owned = await findOwnedConversation({ conversationId, userId: viewer.userId });

  if (!owned) {
    return { status: "notFound" };
  }

  if (owned.row.status !== "ready" || owned.row.reviewRunId !== null) {
    return { status: "conversationEnded" };
  }

  if (isPlusOnlyLiveCall(owned.row.kind) && viewer.tier !== "plus") {
    return { status: "plusRequired" };
  }

  // Read again under the lock when reserving; checked here so a paused call never ends another.
  if ((await readLiveCallAdmission({ transaction: prisma, userId: viewer.userId })) === null) {
    return { status: "callsPaused" };
  }

  if (owned.row.kind === "checkpoint") {
    const started = await startCheckpointBlock(owned.row.studyBlockId);

    if (started) {
      return started;
    }
  }

  const previous = await endPreviousLiveCall({
    conversationId,
    takeover: input.takeover,
    userId: viewer.userId,
  });

  if (previous) {
    return previous;
  }

  const result = await claimLiveCallUsageForViewer({ conversationId, now: new Date(), viewer });

  if (result.status !== "reserved") {
    return result;
  }

  const { connection } = result;
  revalidateCacheTags([getAllowanceCacheTag(viewer.userId)]);

  const scheduled = await safeAsync(() =>
    scheduleDeadline({ connectionId: connection.id, deadlineAt: connection.deadlineAt }),
  );

  if (scheduled.error) {
    await endLiveCall({ connectionId: connection.id, reason: "failed" });
    return { status: "retryable" };
  }

  const seconds = Math.floor((connection.deadlineAt.getTime() - Date.now()) / MS_PER_SECOND);

  return {
    setup: {
      connectionId: connection.id,
      deadlineAt: connection.deadlineAt.toISOString(),
      endsAtLimit: result.endsAtLimit,
      seconds: Math.max(1, seconds),
      sessionUrl: `/v1/language-conversations/${conversationId}/connections/${connection.id}/sdp`,
      voice: getLiveConversationVoice(owned.row.targetLanguage),
    },
    status: "ready",
  };
}
