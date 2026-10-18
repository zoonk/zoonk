import { type TransactionClient } from "@zoonk/db";
import { readBlockPayload } from "../../sessions/block-payload";

const SECONDS_PER_MINUTE = 60;

/** Identifies a plan's owned challenge call so reconnects share its original duration. */
export async function findPlanChallengeCall({
  client,
  conversationId,
  userId,
}: {
  client: TransactionClient;
  conversationId: string;
  userId: string;
}): Promise<{ seconds: number } | null> {
  const call = await client.languageConversation.findFirst({
    include: { studyBlock: { include: { session: true } } },
    where: { goal: { kind: "language", userId }, id: conversationId, kind: "checkpoint", userId },
  });

  const block = call?.studyBlock;

  if (
    !call ||
    !call.goalId ||
    !block ||
    block.kind !== "checkpoint" ||
    block.session.userId !== userId ||
    block.session.goalId !== call.goalId
  ) {
    return null;
  }

  const payload = readBlockPayload(block);

  if (
    !payload.planItemId ||
    (payload.checkpoint?.kind !== "boss" && payload.checkpoint?.kind !== "finalBoss")
  ) {
    return null;
  }

  const item = await client.planItem.findFirst({
    where: {
      id: payload.planItemId,
      kind: "boss",
      plan: { goal: { userId }, goalId: call.goalId },
    },
  });

  return item ? { seconds: call.minutes * SECONDS_PER_MINUTE } : null;
}
