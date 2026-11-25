import { type AnswerMaterial, type ScoredAnswer } from "./brain-power";

export type AnswerRecord = {
  answeredAt: Date;
  id: string;
  isCorrect: boolean;
  itemId: string | null;
  stepId: string | null;
};

export function isSameQuestion(answer: AnswerRecord, other: AnswerRecord): boolean {
  return (
    (answer.itemId !== null && answer.itemId === other.itemId) ||
    (answer.stepId !== null && answer.stepId === other.stepId)
  );
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

/** Capsule/drill questions count as due; prior correct answers reduce rewards for non-due repeats. */
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
    const priorRightAnswers = history.filter(
      (earlier) =>
        earlier.id !== answer.id &&
        earlier.isCorrect &&
        isSameQuestion(answer, earlier) &&
        earlier.answeredAt < answer.answeredAt,
    ).length;

    const isDue = answer.itemId !== null && dueItemIds.has(answer.itemId);

    return { ...answer, material: getMaterial({ isDue, priorRightAnswers }), priorRightAnswers };
  });
}
