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

async function settleHungUp({
  alreadyEnded,
  connection,
  reason,
}: {
  alreadyEnded: boolean;
  connection: LiveCallConnection;
  reason: LiveCallEndReason;
}): Promise<void> {
  const settled = await prisma.$transaction(async (transaction) => {
    await lockUsageForViewer({ transaction, userId: connection.userId });

    const current = await transaction.liveCallConnection.findUniqueOrThrow({
      where: { id: connection.id },
    });

    const now = new Date();
    // OpenAI already ended it, so the app or browser left without ending the call: a crash keeps
    // only the time the call was seen in use, never the rest of the learner's day.
    const liveUntil = alreadyEnded ? (current.lastActiveAt ?? current.startedAt ?? now) : now;
    const charge = getEndingCharge({ connection: current, liveUntil, now });

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
    revalidateCacheTags([getAllowanceCacheTag(original.userId)]);
    return step;
  }

  const { connection, providerSessionId } = step;
  const hungUp = await safeAsync(() => hangUpLiveCallSession(providerSessionId));

  if (hungUp.error) {
    return { status: "closing" };
  }

  await settleHungUp({ alreadyEnded: hungUp.data === "alreadyEnded", connection, reason });
  revalidateCacheTags([getAllowanceCacheTag(connection.userId)]);

  return { status: "ended" };
}
