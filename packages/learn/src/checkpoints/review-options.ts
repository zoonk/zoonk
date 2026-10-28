import { type QuestionAnswer } from "@zoonk/core/sessions/contract";

type ReviewedOption = { index: number; picked: boolean; result: "right" | "wrong" };

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

/** An answer given before the screen was opened again isn't known, so a wrong one shows only the right option. */
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
