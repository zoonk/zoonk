import { type MistakeCauseInput } from "@zoonk/ai/tasks/v2/mistakes/cause";
import { type Mistake, type TransactionClient, prisma } from "@zoonk/db";
import { type MistakeSignals, inferMistakeCause } from "./mistake-cause";
import { type MistakeSnapshot } from "./mistake-snapshot";

/** A mistake whose pattern was ambiguous, waiting for the classifier to name its cause. */
export type MistakeCauseRequest = { input: MistakeCauseInput; mistakeId: string; userId: string };

type MistakeTarget = { itemId: string | null; stepId: string | null };

/** The open entry for the same question, so answering it wrong again doesn't add a duplicate. */
function findOpenMistake({
  itemId,
  stepId,
  transaction,
  userId,
}: MistakeTarget & { transaction: TransactionClient; userId: string }) {
  const targets = [itemId ? { itemId } : null, stepId ? { stepId } : null].filter(
    (target) => target !== null,
  );

  if (targets.length === 0) {
    return null;
  }

  return transaction.mistake.findFirst({ where: { OR: targets, status: "open", userId } });
}

function toCauseInput({
  language,
  signals,
  snapshot,
}: {
  language: string;
  signals: MistakeSignals;
  snapshot: MistakeSnapshot;
}): MistakeCauseInput {
  const { correct, total } = signals.recentSkillAnswers;

  return {
    correctAnswer: snapshot.correctAnswer ?? "",
    language,
    learnerAnswer: snapshot.answer ?? "",
    misconception: snapshot.misconception ?? "",
    question: snapshot.question,
    recentAccuracy: `${correct} of ${total} right`,
  };
}

/**
 * Adds a wrong answer to the notebook with its snapshot and, when the pattern is clear, its cause.
 * An ambiguous pattern leaves the cause empty and returns a request for the classifier, which runs
 * after the response so answering never waits on a model. A question already open in the notebook
 * keeps its entry.
 */
export async function recordMistake(
  {
    attemptId,
    itemId,
    language,
    practicedMistakeId,
    signals,
    skillId,
    snapshot,
    stepId,
    targetLanguage,
    userId,
  }: MistakeTarget & {
    attemptId: string;
    language: string;
    practicedMistakeId?: string | null;
    signals: MistakeSignals;
    skillId: string | null;
    snapshot: MistakeSnapshot;
    targetLanguage?: string | null;
    userId: string;
  },
  transaction: TransactionClient = prisma,
): Promise<{ causeRequest: MistakeCauseRequest | null; mistake: Mistake }> {
  /** Writing corrections establish the error, not whether the learner misread, guessed or forgot. */
  const isLanguageWriting = Boolean(targetLanguage) && snapshot.format === "typedAnswer";
  const cause = isLanguageWriting ? null : inferMistakeCause(signals);
  const unknownGap = signals.dontKnow && cause === "gap";

  // An explicit unknown is evidence of a gap, including when a drill targets a different question.
  const target =
    unknownGap && practicedMistakeId
      ? await transaction.mistake.findFirst({ where: { id: practicedMistakeId, userId } })
      : null;

  const existing = target ?? (await findOpenMistake({ itemId, stepId, transaction, userId }));

  if (existing) {
    const mistake = unknownGap
      ? await transaction.mistake.update({
          data: { cause: "gap", fixedAt: null, status: "open" },
          where: { id: existing.id },
        })
      : existing;

    return { causeRequest: null, mistake };
  }

  const mistake = await transaction.mistake.create({
    data: { attemptId, cause, itemId, skillId, snapshot, stepId, userId },
  });

  const causeRequest =
    cause || isLanguageWriting
      ? null
      : { input: toCauseInput({ language, signals, snapshot }), mistakeId: mistake.id, userId };

  return { causeRequest, mistake };
}
