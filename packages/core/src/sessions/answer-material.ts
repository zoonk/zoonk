import { type AnswerMaterial, type ScoredAnswer } from "./brain-power";

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
