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

/** The hex digits of a hash a UUID is read from: its version and variant digits are the other two. */
const UUID_HASH_DIGITS = 30;

/** A UUID's five groups, without its version and variant digits. */
const UUID_GROUPS = /^(?<first>.{8})(?<second>.{4})(?<third>.{3})(?<fourth>.{3})(?<fifth>.{12})$/u;

/**
 * The id an answer an app sends under its own key is saved under: the same learner, question and
 * key always give the same id, and nobody else's do, so a key can neither collide with another
 * learner's answer nor tell whether one exists. A version 8 UUID (with the standard variant) read
 * from a hash of the three, so it's a UUID wherever one is checked.
 */
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

/** The learner's answer saved under this id, when it was saved already. */
export function findSavedAttempt({
  attemptId,
  userId,
}: {
  attemptId: string;
  userId: string;
}): Promise<Attempt | null> {
  return prisma.attempt.findFirst({ where: { id: attemptId, userId } });
}

/** The answer can't be recorded now (see `recordAnswerOnce`'s `refuse`): the transaction rolls back. */
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

/**
 * Records an answer in one transaction with the learner's revision:
 * - once under its id: the same answer sent twice at once fails on the id in the second request,
 *   which rolls back with its revision and gets the attempt the first one saved;
 * - only when `refuse` finds nothing against it: it locks what the answer belongs to (a lesson
 *   run, a writing block) and says why the answer can't be recorded now (it closed, or a later
 *   answer to the question was recorded first). It runs after the learner's lock, which every one
 *   of their answers takes first, so it sees each of their answers committed before, and a finish
 *   either waits for the answer or the answer sees it finished;
 * - with `withAnswer`, the writes that must commit with it (a lesson answer's language evidence),
 *   so an answer sent again never finds itself saved without them.
 *
 * Any other failure is thrown as it is.
 */
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
