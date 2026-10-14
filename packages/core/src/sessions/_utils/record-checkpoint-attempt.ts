import { prisma } from "@zoonk/db";
import {
  type LearnerAnswer,
  type RecordedLearnerAnswer,
  persistLearnerAnswer,
  publishLearnerAnswer,
} from "../../learner/record-learner-answer";
import { getBlockItemIds, readBlockPayload } from "../block-payload";

type CheckpointAttemptResult =
  | { created: boolean; recorded: RecordedLearnerAnswer; status: "ready" }
  | { status: "blockNotActive" | "invalidItem" | "notFound" };

/**
 * Checkpoints accept one verdict per question. Lock before checking and inserting, in the same
 * owner-before-block-before-session order as queue restoration. Overdue checkpoints can share
 * an item, so the session lock also serializes their session/item claim. Attempt, memory, and
 * notebook writes commit together before either submission returns. Models and plan changes
 * stay outside these locks; analytics and cache invalidation run only after commit.
 */
export async function recordCheckpointAttempt({
  blockId,
  input,
}: {
  blockId: string;
  input: LearnerAnswer & { itemId: string; studySessionId: string };
}): Promise<CheckpointAttemptResult> {
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${input.userId}::uuid FOR KEY SHARE`;

    await tx.$queryRaw`
      SELECT id FROM study_session_blocks
      WHERE id = ${blockId}::uuid AND session_id = ${input.studySessionId}::uuid FOR UPDATE
    `;

    await tx.$queryRaw`
      SELECT id FROM study_sessions
      WHERE id = ${input.studySessionId}::uuid AND user_id = ${input.userId}::uuid FOR NO KEY UPDATE
    `;

    const block = await tx.studySessionBlock.findFirst({
      where: { id: blockId, session: { userId: input.userId }, sessionId: input.studySessionId },
    });

    if (!block) {
      return { status: "notFound" as const };
    }

    const payload = readBlockPayload(block);

    if (
      block.kind !== "checkpoint" ||
      payload.checkpoint?.mock ||
      !getBlockItemIds(payload).includes(input.itemId)
    ) {
      return { status: "invalidItem" as const };
    }

    const existing = await tx.attempt.findFirst({
      orderBy: [{ answeredAt: "desc" }, { id: "desc" }],
      where: { itemId: input.itemId, studySessionId: input.studySessionId, userId: input.userId },
    });

    if (existing) {
      const mistake = await tx.mistake.findFirst({
        where: { attemptId: existing.id, userId: input.userId },
      });

      const recorded: RecordedLearnerAnswer = {
        attempt: existing,
        causeRequest: null,
        fixedMistakeIds: [],
        learnerSkill: null,
        mistake,
      };

      return { created: false, events: [], recorded, status: "ready" as const };
    }

    if (block.status !== "active") {
      return { status: "blockNotActive" as const };
    }

    const { events, recorded } = await persistLearnerAnswer({ input, transaction: tx });

    await tx.studySessionBlock.update({
      data: {
        payload: {
          ...payload,
          checkpointAnswers: [
            ...payload.checkpointAnswers,
            { attemptId: recorded.attempt.id, itemId: input.itemId },
          ],
        },
      },
      where: { id: blockId },
    });

    return { created: true, events, recorded, status: "ready" as const };
  });

  if (result.status === "ready" && result.created) {
    publishLearnerAnswer({ events: result.events, userId: input.userId });
  }

  return result;
}
