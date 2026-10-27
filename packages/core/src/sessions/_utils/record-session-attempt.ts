import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { markLearnerChanged } from "../../learner/_utils/mark-learner-changed";
import {
  type LearnerAnswer,
  type RecordedLearnerAnswer,
  persistLearnerAnswer,
  publishLearnerAnswer,
} from "../../learner/record-learner-answer";
import { getBlockItemIds, readBlockPayload } from "../block-payload";

type SessionAttemptResult =
  | { created: boolean; recorded: RecordedLearnerAnswer; status: "ready" }
  | { status: "alreadyAnswered" | "blockNotActive" | "invalidItem" | "notFound" };

/** A replay or refusal rolls back the learner mark taken before the block locks. */
class SessionAnswerUnchangedError extends Error {
  readonly result: SessionAttemptResult;

  constructor(result: SessionAttemptResult) {
    super("The session answer did not change");
    this.name = "SessionAnswerUnchangedError";
    this.result = result;
  }
}

/**
 * A session accepts one verdict per question, even from two tabs at once: a checkpoint acknowledges
 * a repeat with the verdict it stored, and any other block says it was answered already. Lock
 * before checking and inserting, in the same plans-before-owner-before-block-before-session order.
 * Overdue checkpoints can share an item, so the session lock also serializes their session/item
 * claim. Attempt, memory, and notebook writes commit together before either submission returns.
 * Models and plan changes stay outside these locks; analytics and cache invalidation run only
 * after commit.
 */
export async function recordSessionAttempt({
  blockId,
  input,
}: {
  blockId: string;
  input: LearnerAnswer & { itemId: string; studySessionId: string };
}): Promise<SessionAttemptResult> {
  const { data: result, error } = await safeAsync(() =>
    prisma.$transaction(async (tx) => {
      await markLearnerChanged(tx, { planInputs: true, userId: input.userId });

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
        throw new SessionAnswerUnchangedError({ status: "notFound" });
      }

      const payload = readBlockPayload(block);

      if (payload.checkpoint?.mock || !getBlockItemIds(payload).includes(input.itemId)) {
        throw new SessionAnswerUnchangedError({ status: "invalidItem" });
      }

      const existing = await tx.attempt.findFirst({
        orderBy: [{ answeredAt: "desc" }, { id: "desc" }],
        where: { itemId: input.itemId, studySessionId: input.studySessionId, userId: input.userId },
      });

      if (existing && block.kind !== "checkpoint") {
        throw new SessionAnswerUnchangedError({ status: "alreadyAnswered" });
      }

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

        throw new SessionAnswerUnchangedError({ created: false, recorded, status: "ready" });
      }

      if (block.status !== "active") {
        throw new SessionAnswerUnchangedError({ status: "blockNotActive" });
      }

      const { events, recorded } = await persistLearnerAnswer({ input, transaction: tx });

      if (block.kind === "checkpoint") {
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
      }

      return { created: true, events, recorded, status: "ready" as const };
    }),
  );

  if (error instanceof SessionAnswerUnchangedError) {
    return error.result;
  }

  if (error) {
    throw error;
  }

  publishLearnerAnswer({ events: result.events, userId: input.userId });

  return result;
}
