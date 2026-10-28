import { prisma } from "@zoonk/db";
import { connectLanguageConversation } from "../language/conversations/connect-language-conversation";
import { redeemLiveCallSdp } from "../language/conversations/redeem-live-call-sdp";

const ownedConversationIds = new Set<string>();
const originatingConnectionIds = new Map<string, string>();

export async function setupTestCalls() {
  await prisma.liveCallSetting.upsert({
    create: { admission: "all", freeDailyBudgetMicros: 150_000_000, id: "live" },
    update: { admission: "all", freeDailyBudgetMicros: 150_000_000 },
    where: { id: "live" },
  });
}

export async function reserveTestCall(conversationId: string) {
  ownedConversationIds.add(conversationId);

  const reserved = await connectLanguageConversation({
    conversationId,
    scheduleDeadline: async () => null,
  });

  if (reserved.status === "ready") {
    originatingConnectionIds.set(conversationId, reserved.setup.connectionId);
  }

  return reserved;
}

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

export function testCallCompletionInput<T extends object>(conversationId: string, input: T) {
  const connectionId = originatingConnectionIds.get(conversationId);

  if (!connectionId) {
    throw new Error("Expected this test's originating call reservation");
  }

  return { ...input, connectionId };
}

/** Fake clock advances must not leave this file's open connections in later budget decisions. */
export async function cleanupTestCalls() {
  await prisma.liveCallConnection.deleteMany({
    where: { conversationId: { in: [...ownedConversationIds] } },
  });

  ownedConversationIds.clear();
  originatingConnectionIds.clear();
}
