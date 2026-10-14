import { recordLiveConversationUsage } from "@zoonk/ai/tasks/v2/language/live-conversation-usage";
import { type LiveCallConnection, type TransactionClient, prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { type EntitlementViewer } from "../../../entitlements/_utils/entitlement-viewer";
import { refreshLiveCallViewer } from "../../../entitlements/_utils/live-call-viewer";
import { lockUsageForViewer } from "../../../entitlements/_utils/usage-lock";
import { LIVE_CALL_INITIALIZATION_SECONDS } from "../../../entitlements/limits";
import { isPlusOnlyLiveCall } from "./live-call-plus";
import { readLiveCallAdmission } from "./live-call-policy";
import { settleLiveCall } from "./settle-live-call";

const PERSISTENCE_ATTEMPTS = 3;

type PersistenceInput = {
  connection: LiveCallConnection;
  forceClosing?: boolean;
  providerSessionId: string;
  terminal?: { observedAt: Date; seconds: number };
  viewer: EntitlementViewer;
};

type PersistedSession = { active: boolean; newlySettledSeconds?: number };

async function canActivateSession({
  current,
  input,
  transaction,
}: {
  current: LiveCallConnection;
  input: PersistenceInput;
  transaction: TransactionClient;
}): Promise<boolean> {
  if (input.forceClosing) {
    return false;
  }

  const now = new Date();

  const [slot, conversation, freshViewer, admission] = await Promise.all([
    transaction.liveCallSlot.findUnique({ where: { userId: current.userId } }),
    transaction.languageConversation.findUnique({ where: { id: current.conversationId } }),
    refreshLiveCallViewer({
      isGuest: input.viewer.isGuest,
      now,
      transaction,
      userId: current.userId,
    }),
    readLiveCallAdmission({ transaction, userId: current.userId }),
  ]);

  return (
    current.state === "creating" &&
    current.generation === input.connection.generation &&
    current.deadlineAt > now &&
    slot?.connectionId === current.id &&
    slot.generation === current.generation &&
    conversation?.status === "ready" &&
    conversation.completionStartedAt === null &&
    (!isPlusOnlyLiveCall(conversation.kind) || freshViewer?.tier === "plus") &&
    admission !== null
  );
}

/** Cleanup closed it without an ID and kept an estimate: a session that turns up must still close. */
function isClosedWithoutProvider(current: LiveCallConnection): boolean {
  return (
    current.state === "closed" &&
    current.costConfidence === "estimated" &&
    current.providerSessionId === null
  );
}

/**
 * The known ID always stays. A row closed with an estimate opens again as closing, its estimate
 * owed until a close confirms the real cost; its slot and learner time were already returned.
 */
function persistedConnectionData({
  active,
  current,
  providerSessionId,
}: {
  active: boolean;
  current: LiveCallConnection;
  providerSessionId: string;
}) {
  if (isClosedWithoutProvider(current)) {
    return {
      closedAt: null,
      costConfidence: "unconfirmed" as const,
      liabilityMicros: current.settledMicros,
      providerSessionId,
      settledMicros: 0,
      state: "closing" as const,
    };
  }

  if (current.state === "closed") {
    return { providerSessionId };
  }

  return { providerSessionId, state: active ? ("active" as const) : ("closing" as const) };
}

async function persistSessionOnce(input: PersistenceInput): Promise<PersistedSession> {
  return prisma.$transaction(async (transaction) => {
    await lockUsageForViewer({ transaction, userId: input.connection.userId });

    const current = await transaction.liveCallConnection.findUniqueOrThrow({
      where: { id: input.connection.id },
    });

    const active = await canActivateSession({ current, input, transaction });
    /** Late/uncertain responses always retain the known ID, even when activation was revoked. */
    const persisted = await transaction.liveCallConnection.update({
      data: persistedConnectionData({
        active,
        current,
        providerSessionId: input.providerSessionId,
      }),
      where: { id: current.id },
    });

    if (input.terminal && persisted.state !== "closed") {
      await settleLiveCall({
        connection: persisted,
        now: input.terminal.observedAt,
        seconds: input.terminal.seconds,
        transaction,
      });

      return {
        active: false,
        newlySettledSeconds: Math.max(LIVE_CALL_INITIALIZATION_SECONDS, input.terminal.seconds),
      };
    }

    if (active) {
      await transaction.languageConversation.updateMany({
        data: { liveModel: "openai/gpt-live-1", startedAt: current.providerStartedAt },
        where: { id: current.conversationId, startedAt: null },
      });
    }

    return { active };
  });
}

/** Retrying database persistence never retries provider creation or discards its returned ID. */
export async function persistLiveCallSession(
  input: PersistenceInput,
  attemptsLeft = PERSISTENCE_ATTEMPTS,
): Promise<SafeReturn<PersistedSession>> {
  const result = await safeAsync(() => persistSessionOnce(input));

  if (result.error && attemptsLeft > 1) {
    return persistLiveCallSession(input, attemptsLeft - 1);
  }

  if (result.data?.newlySettledSeconds !== undefined) {
    await recordLiveConversationUsage({
      analytics: { contentScope: "personal", distinctId: input.connection.userId },
      runId: input.connection.id,
      seconds: result.data.newlySettledSeconds,
    });
  }

  return result;
}
