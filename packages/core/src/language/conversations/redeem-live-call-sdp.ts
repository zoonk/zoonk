import "server-only";
import { LiveCallCreationRefusedError } from "@zoonk/ai/tasks/v2/language/live-call-creation";
import {
  createLiveCallSession,
  hangUpLiveCallSession,
} from "@zoonk/ai/tasks/v2/language/live-call-session";
import { getLiveConversationVoice } from "@zoonk/ai/tasks/v2/language/live-conversation-models";
import { type LiveCallConnection, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getAllowanceCacheTag } from "../../cache/tags";
import { getEntitlementViewer } from "../../entitlements/_utils/entitlement-viewer";
import { lockFreeCallDay } from "../../entitlements/_utils/free-call-spend";
import { refreshLiveCallViewer } from "../../entitlements/_utils/live-call-viewer";
import { lockUsageForViewer } from "../../entitlements/_utils/usage-lock";
import { getLiveCallCostMicros } from "../../entitlements/limits";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { buildConversationInstructions } from "./_utils/conversation-view";
import { getEndingCharge, isWithinConnectWindow } from "./_utils/live-call-money";
import { isPlusOnlyLiveCall } from "./_utils/live-call-plus";
import { readLiveCallAdmission } from "./_utils/live-call-policy";
import { settleLiveCall } from "./_utils/settle-live-call";
import { type LiveCallSdpInput } from "./conversation-contract";
import { endLiveCall } from "./end-live-call";

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

type Refusal = Exclude<RedeemLiveCallSdpResult, { status: "ready" }>;

type Prepared =
  | Refusal
  | { connection: LiveCallConnection; instructions: string; status: "prepared"; voice: string };

/** A reservation the SDP step can't use: one ended or past its window expired, others were used. */
function unusableReservation({
  connection,
  now,
}: {
  connection: LiveCallConnection;
  now: Date;
}): Refusal | null {
  if (connection.state === "reserved") {
    return isWithinConnectWindow({ connection, now }) && connection.deadlineAt > now
      ? null
      : { status: "connectionExpired" };
  }

  return connection.state === "ended" && connection.startedAt === null
    ? { status: "connectionExpired" }
    : { status: "connectionUsed" };
}

/**
 * Under the learner's lock, with admission, Plus and the conversation read fresh: the reservation
 * moves to `starting` once, so a second offer for it never creates a second session.
 */
async function prepareCreation({
  connectionId,
  conversationId,
  isGuest,
  userId,
}: {
  connectionId: string;
  conversationId: string;
  isGuest: boolean;
  userId: string;
}): Promise<Prepared> {
  return writeLearnerChange<Prepared>({ userId }, async (transaction) => {
    await lockUsageForViewer({ transaction, userId });

    const [connection, conversation] = await Promise.all([
      transaction.liveCallConnection.findFirst({
        where: { conversationId, id: connectionId, userId },
      }),
      transaction.languageConversation.findFirst({
        include: { chapter: { select: { id: true, title: true } } },
        where: { id: conversationId, userId },
      }),
    ]);

    if (!connection || !conversation) {
      return unchanged({ status: "notFound" as const });
    }

    const now = new Date();
    const instructions = buildConversationInstructions(conversation);

    if (!instructions || conversation.reviewRunId !== null) {
      return unchanged({ status: "conversationEnded" as const });
    }

    const viewer = await refreshLiveCallViewer({ isGuest, now, transaction, userId });

    if (isPlusOnlyLiveCall(conversation.kind) && viewer?.tier !== "plus") {
      return unchanged({ status: "plusRequired" as const });
    }

    if ((await readLiveCallAdmission({ transaction, userId })) === null) {
      return unchanged({ status: "callsPaused" as const });
    }

    // A free reservation's window is read under the free day's lock, with the clock read after it:
    // a reservation reading this one as expired meanwhile can't also give away its room.
    if (connection.freeSpendDay && connection.state === "reserved") {
      await lockFreeCallDay({ day: connection.freeSpendDay, transaction });
    }

    const lockedAt = new Date();
    const unusable = unusableReservation({ connection, now: lockedAt });

    if (unusable) {
      return unchanged(unusable);
    }

    const starting = await transaction.liveCallConnection.update({
      data: { startedAt: lockedAt, state: "starting" },
      where: { id: connection.id },
    });

    return {
      connection: starting,
      instructions,
      status: "prepared" as const,
      voice: getLiveConversationVoice(conversation.targetLanguage),
    };
  });
}

/**
 * Creation failed without naming a session. OpenAI's own refusal means no session started, so
 * only initialization is kept; anything else (a timeout, a server error) may have started one we
 * can't hang up, so the larger of the reservation and the clock is kept.
 */
async function settleFailedCreation({
  connection,
  refused,
}: {
  connection: LiveCallConnection;
  refused: boolean;
}): Promise<void> {
  await prisma.$transaction(async (transaction) => {
    await lockUsageForViewer({ transaction, userId: connection.userId });

    const current = await transaction.liveCallConnection.findUniqueOrThrow({
      where: { id: connection.id },
    });

    if (current.providerSessionId) {
      return;
    }

    const now = new Date();

    await settleLiveCall({
      connection: current,
      ...(refused
        ? { costMicros: getLiveCallCostMicros(0), learnerSeconds: 0 }
        : getEndingCharge({ connection: current, now })),
      endReason: refused ? "refused" : "failed",
      now,
      transaction,
    });
  });

  revalidateCacheTags([getAllowanceCacheTag(connection.userId)]);
}

type Created = { status: "live" } | { settled: boolean; status: "unwanted" };

/**
 * The session exists: it goes live only while the connection is still `starting`, no end was asked
 * for and no review has claimed the call. Otherwise its id is kept so the session is hung up.
 */
async function recordCreatedSession({
  connection,
  providerSessionId,
}: {
  connection: LiveCallConnection;
  providerSessionId: string;
}): Promise<Created> {
  return writeLearnerChange<Created>({ userId: connection.userId }, async (transaction) => {
    await lockUsageForViewer({ transaction, userId: connection.userId });

    const [current, conversation] = await Promise.all([
      transaction.liveCallConnection.findUniqueOrThrow({ where: { id: connection.id } }),
      transaction.languageConversation.findUnique({ where: { id: connection.conversationId } }),
    ]);

    const wanted =
      current.state === "starting" &&
      current.endReason === null &&
      conversation?.status === "ready" &&
      conversation.reviewRunId === null;

    await transaction.liveCallConnection.update({
      data: { providerSessionId, ...(wanted ? { state: "live" as const } : {}) },
      where: { id: current.id },
    });

    if (!wanted) {
      return { settled: current.state === "ended", status: "unwanted" };
    }

    await transaction.languageConversation.updateMany({
      data: { liveModel: "openai/gpt-live-1", startedAt: current.startedAt },
      where: { id: current.conversationId, startedAt: null },
    });

    return { status: "live" };
  });
}

/**
 * Creates the GPT-Live session for the browser's offer, once per reservation, with the server's
 * model, instructions, voice and event permissions. The call's time already runs from its
 * reservation. A session that's no longer wanted when it exists (the call was ended, replaced or
 * claimed for review meanwhile) is hung up at once.
 */
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

  const prepared = await prepareCreation({
    connectionId,
    conversationId,
    isGuest: viewer.isGuest,
    userId: viewer.userId,
  });

  if (prepared.status !== "prepared") {
    return prepared;
  }

  const { connection } = prepared;

  const created = await safeAsync(() =>
    createLiveCallSession({
      instructions: prepared.instructions,
      sdp: input.sdp,
      voice: prepared.voice,
    }),
  );

  if (!created.data) {
    await settleFailedCreation({
      connection,
      refused: created.error instanceof LiveCallCreationRefusedError,
    });

    return { status: "retryable" };
  }

  const { sessionId } = created.data;

  const recorded = await safeAsync(() =>
    recordCreatedSession({ connection, providerSessionId: sessionId }),
  );

  if (recorded.error) {
    // The connection stays `starting` without the id: it settles by estimate when it ends.
    await safeAsync(() => hangUpLiveCallSession(sessionId));
    throw recorded.error;
  }

  if (recorded.data.status === "unwanted") {
    // A connection already settled by estimate only needs its session gone.
    await (recorded.data.settled
      ? safeAsync(() => hangUpLiveCallSession(sessionId))
      : endLiveCall({ connectionId, reason: "completion" }));

    return { status: "previousConnectionClosing" };
  }

  return { ...created.data, status: "ready" };
}
