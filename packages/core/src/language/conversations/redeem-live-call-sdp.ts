import "server-only";
import { LiveCallCreationRefusedError } from "@zoonk/ai/tasks/v2/language/live-call-creation";
import {
  closeLiveCallSession,
  createLiveCallSession,
} from "@zoonk/ai/tasks/v2/language/live-call-session";
import { getLiveConversationVoice } from "@zoonk/ai/tasks/v2/language/live-conversation-models";
import { type LiveCallConnection, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getAllowanceCacheTag } from "../../cache/tags";
import { getEntitlementViewer } from "../../entitlements/_utils/entitlement-viewer";
import { refreshLiveCallViewer } from "../../entitlements/_utils/live-call-viewer";
import { lockUsageForViewer } from "../../entitlements/_utils/usage-lock";
import { toConversationView } from "./_utils/conversation-view";
import { isPlusOnlyLiveCall } from "./_utils/live-call-plus";
import { readLiveCallAdmission } from "./_utils/live-call-policy";
import { persistLiveCallSession } from "./_utils/persist-live-call-session";
import { settleLiveCall } from "./_utils/settle-live-call";
import { closeLiveCallConnection } from "./close-live-call-connection";
import { type LiveCallSdpInput } from "./conversation-contract";

export type RedeemLiveCallSdpResult =
  | { sdp: string; sessionId: string; status: "ready" }
  | {
      status:
        | "unauthorized"
        | "notFound"
        | "callsPaused"
        | "conversationEnded"
        | "plusRequired"
        | "connectionExpired"
        | "connectionUsed"
        | "previousConnectionClosing"
        | "retryable";
    };

/** The provider proved it created nothing: the call never started, so its slot, time and money return. */
async function releaseRefusedLiveCall(connection: LiveCallConnection): Promise<void> {
  await prisma.$transaction(async (transaction) => {
    await lockUsageForViewer({ transaction, userId: connection.userId });

    const current = await transaction.liveCallConnection.findUniqueOrThrow({
      where: { id: connection.id },
    });

    if (
      current.generation !== connection.generation ||
      current.state === "closed" ||
      current.providerSessionId !== null
    ) {
      return;
    }

    await transaction.liveCallConnection.update({
      data: { providerStartedAt: null },
      where: { id: current.id },
    });

    await settleLiveCall({ connection: current, now: new Date(), seconds: null, transaction });
  });

  revalidateCacheTags([getAllowanceCacheTag(connection.userId)]);
}

/** Session auth, receipt and a single-use fence precede every provider creation request. */
export async function redeemLiveCallSdp({
  connectionId,
  conversationId,
  input,
}: {
  connectionId: string;
  conversationId: string;
  input: LiveCallSdpInput;
}): Promise<RedeemLiveCallSdpResult> {
  const viewer = await getEntitlementViewer();

  if (!viewer) {
    return { status: "unauthorized" };
  }

  const prepared = await prisma.$transaction(async (transaction) => {
    await lockUsageForViewer({ transaction, userId: viewer.userId });

    const [connection, conversation, slot] = await Promise.all([
      transaction.liveCallConnection.findFirst({
        where: { conversationId, id: connectionId, userId: viewer.userId },
      }),
      transaction.languageConversation.findFirst({
        include: { chapter: { select: { id: true, title: true } } },
        where: { id: conversationId, userId: viewer.userId },
      }),
      transaction.liveCallSlot.findUnique({ where: { userId: viewer.userId } }),
    ]);

    if (!connection || !conversation) {
      return { status: "notFound" as const };
    }

    if (conversation.status !== "ready" || conversation.completionStartedAt !== null) {
      return { status: "conversationEnded" as const };
    }

    const freshViewer = await refreshLiveCallViewer({
      isGuest: viewer.isGuest,
      now: new Date(),
      transaction,
      userId: viewer.userId,
    });

    if (isPlusOnlyLiveCall(conversation.kind) && freshViewer?.tier !== "plus") {
      return { status: "plusRequired" as const };
    }

    if ((await readLiveCallAdmission({ transaction, userId: viewer.userId })) === null) {
      return { status: "callsPaused" as const };
    }

    if (connection.state === "closing") {
      return { status: "previousConnectionClosing" as const };
    }

    if (
      connection.state !== "pending" ||
      slot?.connectionId !== connectionId ||
      slot.generation !== connection.generation
    ) {
      return { status: "connectionUsed" as const };
    }

    const now = new Date();

    if (connection.deadlineAt <= now) {
      return { status: "connectionExpired" as const };
    }

    if (!connection.workflowRunId) {
      return { status: "retryable" as const };
    }

    const instructions = toConversationView({ row: conversation })?.instructions;

    if (!instructions) {
      return { status: "conversationEnded" as const };
    }

    await transaction.liveCallConnection.update({
      data: { providerStartedAt: now, state: "creating" },
      where: { id: connectionId },
    });

    return { connection, conversation, instructions, status: "prepared" as const };
  });

  if (prepared.status !== "prepared") {
    return prepared;
  }

  const created = await safeAsync(() =>
    createLiveCallSession({
      instructions: prepared.instructions,
      sdp: input.sdp,
      voice: getLiveConversationVoice(prepared.conversation.targetLanguage),
    }),
  );

  if (created.error instanceof LiveCallCreationRefusedError) {
    await releaseRefusedLiveCall(prepared.connection);
    return { status: "retryable" };
  }

  /** Lost responses and timeouts may have started a session: it stays liable until cleanup. */
  if (!created.data) {
    await closeLiveCallConnection({ connectionId, generation: prepared.connection.generation });
    return { status: "retryable" };
  }

  const provider = created.data;

  const persistenceInput = {
    connection: prepared.connection,
    providerSessionId: provider.sessionId,
    viewer,
  };

  const persisted = await persistLiveCallSession(persistenceInput);

  if (persisted.error) {
    /** Persistent database failure is an outage; still keep the known ID through compensation retries. */
    const compensation = await safeAsync(() => closeLiveCallSession(provider.sessionId));

    const retained = await persistLiveCallSession({
      ...persistenceInput,
      forceClosing: true,
      ...(compensation.data
        ? { terminal: { observedAt: new Date(), seconds: compensation.data.seconds } }
        : {}),
    });

    if (retained.error) {
      throw retained.error;
    }

    return { status: "previousConnectionClosing" };
  }

  if (persisted.data.alreadyClosed) {
    /** Cleanup already closed the ID-less row with its estimated cost; still end the late session. */
    await safeAsync(() => closeLiveCallSession(provider.sessionId));
    return { status: "previousConnectionClosing" };
  }

  if (!persisted.data.active) {
    await closeLiveCallConnection({ connectionId, generation: prepared.connection.generation });
    return { status: "previousConnectionClosing" };
  }

  return { ...provider, status: "ready" };
}
