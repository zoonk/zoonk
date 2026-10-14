import { closeLiveCallSession } from "@zoonk/ai/tasks/v2/language/live-call-session";
import { prisma } from "@zoonk/db";
import { vi } from "vitest";
import { connectLanguageConversation } from "../language/conversations/connect-language-conversation";
import { redeemLiveCallSdp } from "../language/conversations/redeem-live-call-sdp";

const MINIMUM_BILLABLE_SECONDS = 15;

const ownedConversationIds = new Set<string>();
const originatingConnectionIds = new Map<string, string>();

/** Only provider finalization and durable scheduling are external test boundaries. */
export async function setupTestCalls() {
  await prisma.liveCallSetting.upsert({
    create: { admission: "all", freeDailyBudgetMicros: 150_000_000, id: "live" },
    update: { admission: "all", freeDailyBudgetMicros: 150_000_000 },
    where: { id: "live" },
  });

  vi.mocked(closeLiveCallSession).mockImplementation(async (sessionId) => {
    const connection = await prisma.liveCallConnection.findFirstOrThrow({
      where: { providerSessionId: sessionId },
    });

    if (!connection.providerStartedAt) {
      throw new Error("Expected provider start time");
    }

    return {
      reason: "close_requested",
      seconds: Math.max(
        MINIMUM_BILLABLE_SECONDS,
        Math.ceil((Date.now() - connection.providerStartedAt.getTime()) / 1000),
      ),
      status: "closed",
    };
  });
}

export async function reserveTestCall(conversationId: string) {
  ownedConversationIds.add(conversationId);

  const reserved = await connectLanguageConversation({
    conversationId,
    scheduleDeadline: async ({ connectionId }) => ({ runId: `test-deadline-${connectionId}` }),
  });

  if (reserved.status === "ready") {
    originatingConnectionIds.set(conversationId, reserved.setup.connectionId);
  }

  return reserved;
}

/** Connect through both public capabilities, just as the real client does. */
export async function connectTestCall(conversationId: string) {
  const reserved = await reserveTestCall(conversationId);

  if (reserved.status !== "ready") {
    throw new Error(`Call reservation failed: ${reserved.status}`);
  }

  const redeemed = await redeemLiveCallSdp({
    connectionId: reserved.setup.connectionId,
    conversationId,
    input: { sdp: "test-offer" },
  });

  if (redeemed.status !== "ready") {
    throw new Error(`SDP redemption failed: ${redeemed.status}`);
  }

  return reserved;
}

/** Uses the originating reservation returned to this test, never the product's latest connection. */
export function testCallCompletionInput<T extends object>(conversationId: string, input: T) {
  const connectionId = originatingConnectionIds.get(conversationId);

  if (!connectionId) {
    throw new Error("Expected this test's originating call reservation");
  }

  return { ...input, connectionId };
}

/** Fake clock advances must not leave overdue test connections blocking other learners. */
export async function cleanupTestCalls() {
  const conversationId = { in: [...ownedConversationIds] };
  await prisma.liveCallSlot.deleteMany({ where: { connection: { conversationId } } });
  await prisma.liveCallConnection.deleteMany({ where: { conversationId } });
  ownedConversationIds.clear();
  originatingConnectionIds.clear();
}
