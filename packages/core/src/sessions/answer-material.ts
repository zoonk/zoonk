import { type AnswerMaterial, type ScoredAnswer } from "./brain-power";

/** One answer, identified by the question it answered: a bank item or a lesson step. */
export type AnswerRecord = {
  answeredAt: Date;
  id: string;
  isCorrect: boolean;
  itemId: string | null;
  stepId: string | null;
};

function getQuestionKey(answer: Pick<AnswerRecord, "itemId" | "stepId">): string | null {
  return answer.itemId ?? answer.stepId;
}

function getMaterial({
  isDue,
  priorRightAnswers,
}: {
  isDue: boolean;
  priorRightAnswers: number;
}): AnswerMaterial {
  if (isDue) {
    return "due";
  }

  return priorRightAnswers > 0 ? "repeat" : "new";
}

/**
 * Tells Brain Power what each answer was worth learning-wise. Capsule and mistake-drill questions
 * are due by definition. Otherwise a question the learner never got right before is new, and one
 * they already got right is an easy repeat, with how many times, so repeats pay less each time.
 */
export function classifyAnswers<TAnswer extends AnswerRecord>({
  answers,
  dueItemIds,
  history,
}: {
  /** The answers to score, in the order they were given. */
  answers: readonly TAnswer[];
  dueItemIds: ReadonlySet<string>;
  /** Every earlier answer of the learner on the same questions (it may include `answers`). */
  history: readonly AnswerRecord[];
}): (TAnswer & ScoredAnswer)[] {
  return answers.map((answer) => {
    const key = getQuestionKey(answer);

    const priorRightAnswers = history.filter(
      (earlier) =>
        earlier.id !== answer.id &&
        earlier.isCorrect &&
        key !== null &&
        getQuestionKey(earlier) === key &&
        earlier.answeredAt < answer.answeredAt,
    ).length;

    const isDue = answer.itemId !== null && dueItemIds.has(answer.itemId);

    return { ...answer, material: getMaterial({ isDue, priorRightAnswers }), priorRightAnswers };
  });
}
