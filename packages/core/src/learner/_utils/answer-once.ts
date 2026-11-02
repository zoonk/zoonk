import "server-only";
import { createHash } from "node:crypto";
import {
  type Attempt,
  type TransactionClient,
  isPrismaUniqueConstraintError,
  prisma,
} from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import {
  type LearnerAnswer,
  type RecordedLearnerAnswer,
  persistLearnerAnswer,
  publishLearnerAnswer,
} from "../record-learner-answer";
import { markLearnerChanged } from "./mark-learner-changed";

const UUID_HASH_DIGITS = 30;

const UUID_GROUPS = /^(?<first>.{8})(?<second>.{4})(?<third>.{3})(?<fourth>.{3})(?<fifth>.{12})$/u;

/** Deterministic per learner, question, and client key; keys cannot reveal or collide with another learner's answers. */
export function getAnswerAttemptId({
  key,
  questionId,
  userId,
}: {
  key: string;
  questionId: string;
  userId: string;
}): string {
  const hex = createHash("sha256")
    .update(`${userId}:${questionId}:${key}`)
    .digest("hex")
    .slice(0, UUID_HASH_DIGITS);

  return hex.replace(UUID_GROUPS, "$<first>-$<second>-8$<third>-8$<fourth>-$<fifth>");
}

export function findSavedAttempt({
  attemptId,
  userId,
}: {
  attemptId: string;
  userId: string;
}): Promise<Attempt | null> {
  return prisma.attempt.findFirst({ where: { id: attemptId, userId } });
}

class AnswerRefusedError extends Error {
  override name = "AnswerRefusedError";
}

export type RecordedOutcome =
  | { recorded: RecordedLearnerAnswer; status: "recorded" }
  | { saved: Attempt; status: "saved" };

export type RefusedOutcome<Refusal extends string> = { refusal: Refusal; status: "refused" };

type RecordAnswerInput = {
  answer: LearnerAnswer;
  withAnswer?: (transaction: TransactionClient) => Promise<void>;
};

/** Locks the learner before refuse/withAnswer and records an attempt id only once. Refusals roll back; duplicate ids return the saved attempt; other failures propagate. */
export function recordAnswerOnce(input: RecordAnswerInput): Promise<RecordedOutcome>;

export function recordAnswerOnce<Refusal extends string>(
  input: RecordAnswerInput & {
    refuse: (transaction: TransactionClient) => Promise<Refusal | null>;
  },
): Promise<RecordedOutcome | RefusedOutcome<Refusal>>;

export async function recordAnswerOnce<Refusal extends string>({
  answer,
  refuse,
  withAnswer,
}: RecordAnswerInput & {
  refuse?: (transaction: TransactionClient) => Promise<Refusal | null>;
}): Promise<RecordedOutcome | RefusedOutcome<Refusal>> {
  const refused: { refusal: Refusal | null } = { refusal: null };

  const { data, error } = await safeAsync(() =>
    prisma.$transaction(async (transaction) => {
      await markLearnerChanged(transaction, { planInputs: true, userId: answer.userId });
      refused.refusal = (await refuse?.(transaction)) ?? null;

      if (refused.refusal) {
        throw new AnswerRefusedError(`The answer can't be recorded: ${refused.refusal}`);
      }

      const persisted = await persistLearnerAnswer({ input: answer, transaction });
      await withAnswer?.(transaction);
      return persisted;
    }),
  );

  if (data) {
    publishLearnerAnswer({ events: data.events, userId: answer.userId });
    return { recorded: data.recorded, status: "recorded" };
  }

  if (error instanceof AnswerRefusedError && refused.refusal) {
    return { refusal: refused.refusal, status: "refused" };
  }

  const saved =
    answer.attemptId && isPrismaUniqueConstraintError(error)
      ? await findSavedAttempt({ attemptId: answer.attemptId, userId: answer.userId })
      : null;

  if (!saved) {
    throw error;
  }

  return { saved, status: "saved" };
}
