import { type QuestionAnswer } from "@zoonk/core/sessions/contract";

/** One option a reviewed question shows, by its place among the question's options. */
export type ReviewedOption = { index: number; picked: boolean; result: "right" | "wrong" };

/** The options an answer picks: one, several, or a statement's true (the first) or false. */
function toOptionIndexes(answer: QuestionAnswer): number[] | null {
  if ("selectedIndex" in answer) {
    return [answer.selectedIndex];
  }

  if ("selectedIndexes" in answer) {
    return answer.selectedIndexes;
  }

  if ("isTrue" in answer) {
    return [answer.isTrue ? 0 : 1];
  }

  return null;
}

/**
 * What a reviewed choice question shows, as the feedback after a question does: the right option
 * and, when it wasn't the pick, the learner's pick, in the options' order. An answer given before
 * the screen was opened again isn't known: a right one was the right option, and a wrong one shows
 * only the right option. Null for a question answered without options (a number, a typed word).
 */
export function getReviewedOptions({
  correctAnswer,
  given,
  isCorrect,
  optionCount,
}: {
  correctAnswer: QuestionAnswer;
  given: QuestionAnswer | null;
  isCorrect: boolean;
  optionCount: number;
}): ReviewedOption[] | null {
  const rightIndexes = toOptionIndexes(correctAnswer);

  if (!rightIndexes) {
    return null;
  }

  const givenIndexes = given ? toOptionIndexes(given) : null;
  const picks = givenIndexes ?? (isCorrect ? rightIndexes : []);

  return Array.from({ length: optionCount }, (_, index) => index).flatMap(
    (index): ReviewedOption[] => {
      const right = rightIndexes.includes(index);
      const picked = picks.includes(index);

      if (!right && !picked) {
        return [];
      }

      return [{ index, picked, result: right ? "right" : "wrong" }];
    },
  );
}
