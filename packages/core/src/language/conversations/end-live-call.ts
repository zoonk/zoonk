import "server-only";
import { LIVE_CALL_CREATE_TIMEOUT_MS } from "@zoonk/ai/tasks/language/live-call-creation";
import {
  type LiveCallHangup,
  hangUpLiveCallSession,
} from "@zoonk/ai/tasks/language/live-call-session";
import { recordLiveConversationUsage } from "@zoonk/ai/tasks/language/live-conversation-usage";
import { type LiveCallConnection, type LiveCallEndReason, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getAllowanceCacheTag } from "../../cache/tags";
import { lockUsageForViewer } from "../../entitlements/_utils/usage-lock";
import { LIVE_CALL_INITIALIZATION_SECONDS } from "../../entitlements/limits";
import { getEndingCharge } from "./_utils/live-call-money";
import { settleLiveCall } from "./_utils/settle-live-call";

const MS_PER_SECOND = 1000;

const CREATION_SETTLED_MS = 2 * LIVE_CALL_CREATE_TIMEOUT_MS;

/**
 * OpenAI's hangup can answer 503 even for a session it already closed, so a hangup it doesn't
 * confirm still ends the call: waiting for proof would block the learner's next call for good.
 * Measured: a session whose app vanished closed itself about 28 s later (`connection_lost`), and
 * the apps hang up at the hard stop on their own, so the cost counts this long past the attempt.
 */
const UNCONFIRMED_CLEANUP_SECONDS = 30;

type HangUpAnswer = LiveCallHangup | "unconfirmed";

export type EndLiveCallResult = { status: "ended" | "closing" | "notFound" };

type EndStep =
  | { status: "ended" | "closing" }
  | { connection: LiveCallConnection; providerSessionId: string; status: "hangUp" };

function isCreationInFlight({ connection, now }: { connection: LiveCallConnection; now: Date }) {
  return (
    connection.startedAt !== null &&
    now.getTime() < connection.startedAt.getTime() + CREATION_SETTLED_MS
  );
}

async function endWithoutProvider({
  connectionId,
  reason,
  userId,
}: {
  connectionId: string;
  reason: LiveCallEndReason;
  userId: string | null;
}): Promise<EndStep> {
  return prisma.$transaction(async (transaction) => {
    await lockUsageForViewer({ transaction, userId: userId ?? connectionId });

    const connection = await transaction.liveCallConnection.findUniqueOrThrow({
      where: { id: connectionId },
    });

    const now = new Date();

    if (connection.state === "ended") {
      return { status: "ended" as const };
    }

    if (connection.providerSessionId) {
      return {
        connection,
        providerSessionId: connection.providerSessionId,
        status: "hangUp" as const,
      };
    }

    if (connection.state === "starting" && isCreationInFlight({ connection, now })) {
      await transaction.liveCallConnection.updateMany({
        data: { endReason: reason },
        where: { endReason: null, id: connection.id },
      });

      return { status: "closing" as const };
    }

    await settleLiveCall({
      connection,
      ...getEndingCharge({ connection, now }),
      endReason: reason,
      now,
      transaction,
    });

    return { status: "ended" as const };
  });
}

function getHangUpCharge({
  answer,
  connection,
  now,
}: {
  answer: HangUpAnswer;
  connection: LiveCallConnection;
  now: Date;
}) {
  // OpenAI ended it on its own, so the app or page left mid-call: keep only the time it was used.
  const liveUntil =
    answer === "alreadyEnded" ? (connection.lastActiveAt ?? connection.startedAt ?? now) : now;

  const billedUntil =
    answer === "unconfirmed"
      ? new Date(now.getTime() + UNCONFIRMED_CLEANUP_SECONDS * MS_PER_SECOND)
      : now;

  return { ...getEndingCharge({ connection, liveUntil, now: billedUntil }), billedUntil };
}

async function settleHangUp({
  answer,
  connection,
  reason,
}: {
  answer: HangUpAnswer;
  connection: LiveCallConnection;
  reason: LiveCallEndReason;
}): Promise<void> {
  const settled = await prisma.$transaction(async (transaction) => {
    await lockUsageForViewer({ transaction, userId: connection.userId ?? connection.id });

    const current = await transaction.liveCallConnection.findUniqueOrThrow({
      where: { id: connection.id },
    });

    const now = new Date();
    const { billedUntil, ...charge } = getHangUpCharge({ answer, connection: current, now });

    const ended = await settleLiveCall({
      connection: current,
      ...charge,
      endReason: reason,
      endUnconfirmed: answer === "unconfirmed",
      now,
      transaction,
    });

    return ended && current.startedAt
      ? Math.max(
          LIVE_CALL_INITIALIZATION_SECONDS,
          Math.ceil((billedUntil.getTime() - current.startedAt.getTime()) / MS_PER_SECOND),
        )
      : null;
  });

  if (settled !== null) {
    await recordLiveConversationUsage({
      analytics: connection.userId
        ? { contentScope: "personal", distinctId: connection.userId }
        : undefined,
      runId: connection.id,
      seconds: settled,
    });
  }
}

/** Trusted callers only: ownership of the connection must already be checked. */
export async function endLiveCall({
  connectionId,
  reason,
}: {
  connectionId: string;
  reason: LiveCallEndReason;
}): Promise<EndLiveCallResult> {
  const original = await prisma.liveCallConnection.findUnique({ where: { id: connectionId } });

  if (!original) {
    return { status: "notFound" };
  }

  const step = await endWithoutProvider({ connectionId, reason, userId: original.userId });

  if (step.status !== "hangUp") {
    if (original.userId) {
      revalidateCacheTags([getAllowanceCacheTag(original.userId)]);
    }

    return step;
  }

  const { connection, providerSessionId } = step;
  const hungUp = await safeAsync(() => hangUpLiveCallSession(providerSessionId));

  if (hungUp.error) {
    logError("[live-calls] OpenAI didn't confirm a hangup; the call ends unconfirmed:", {
      connectionId,
      error: hungUp.error,
    });
  }

  await settleHangUp({ answer: hungUp.error ? "unconfirmed" : hungUp.data, connection, reason });

  if (connection.userId) {
    revalidateCacheTags([getAllowanceCacheTag(connection.userId)]);
  }

  return { status: "ended" };
}
