import "server-only";
import { LIVE_CALL_CREATE_TIMEOUT_MS } from "@zoonk/ai/tasks/v2/language/live-call-creation";
import { hangUpLiveCallSession } from "@zoonk/ai/tasks/v2/language/live-call-session";
import { recordLiveConversationUsage } from "@zoonk/ai/tasks/v2/language/live-conversation-usage";
import { type LiveCallConnection, type LiveCallEndReason, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getAllowanceCacheTag } from "../../cache/tags";
import { lockUsageForViewer } from "../../entitlements/_utils/usage-lock";
import { LIVE_CALL_INITIALIZATION_SECONDS } from "../../entitlements/limits";
import { getEndingCharge } from "./_utils/live-call-money";
import { settleLiveCall } from "./_utils/settle-live-call";

const MS_PER_SECOND = 1000;

/** Twice the adapter's abort: past it, no creation request is still waiting on the provider. */
const CREATION_SETTLED_MS = 2 * LIVE_CALL_CREATE_TIMEOUT_MS;

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

/**
 * Settles what can end without the provider, under the learner's lock: a reservation, or a
 * creation that never named its session once it can't anymore. A creation still in flight only
 * records why it should end, which the SDP step honors the moment the session exists. A session
 * goes on to the hangup.
 */
async function endWithoutProvider({
  connectionId,
  reason,
  userId,
}: {
  connectionId: string;
  reason: LiveCallEndReason;
  userId: string;
}): Promise<EndStep> {
  return prisma.$transaction(async (transaction) => {
    await lockUsageForViewer({ transaction, userId });

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

/**
 * After OpenAI answered that the session is over: its clock up to now settles it, once, and the
 * seconds OpenAI bills (at least initialization's) are recorded beside every other model call.
 */
async function settleHungUp({
  connection,
  reason,
}: {
  connection: LiveCallConnection;
  reason: LiveCallEndReason;
}): Promise<void> {
  const settled = await prisma.$transaction(async (transaction) => {
    await lockUsageForViewer({ transaction, userId: connection.userId });

    const current = await transaction.liveCallConnection.findUniqueOrThrow({
      where: { id: connection.id },
    });

    const now = new Date();
    const charge = getEndingCharge({ connection: current, now });

    const ended = await settleLiveCall({
      connection: current,
      ...charge,
      endReason: reason,
      now,
      transaction,
    });

    return ended && current.startedAt
      ? Math.max(
          LIVE_CALL_INITIALIZATION_SECONDS,
          Math.ceil((now.getTime() - current.startedAt.getTime()) / MS_PER_SECOND),
        )
      : null;
  });

  if (settled !== null) {
    await recordLiveConversationUsage({
      analytics: { contentScope: "personal", distinctId: connection.userId },
      runId: connection.id,
      seconds: settled,
    });
  }
}

/**
 * The only way a connection ends; trusted callers only (the learner's End, Connect, the deadline
 * run and the review run), never with a connection a learner chose for someone else. A session is
 * hung up first, outside any transaction: only once OpenAI answered that it's over does the
 * connection settle, by the clock. A hangup that fails leaves it open and answers `closing`; its
 * cost keeps growing in budget decisions until a later End, start or the deadline ends it.
 */
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
    revalidateCacheTags([getAllowanceCacheTag(original.userId)]);
    return step;
  }

  const { connection, providerSessionId } = step;
  const hungUp = await safeAsync(() => hangUpLiveCallSession(providerSessionId));

  if (hungUp.error) {
    return { status: "closing" };
  }

  await settleHungUp({ connection, reason });
  revalidateCacheTags([getAllowanceCacheTag(connection.userId)]);

  return { status: "ended" };
}
