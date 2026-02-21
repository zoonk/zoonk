import {
  type FillBlankStepContent,
  type MatchColumnsStepContent,
  type MultipleChoiceStepContent,
  type SelectImageStepContent,
  type SortOrderStepContent,
} from "@zoonk/core/steps/content-contract";

export type AnswerResult = {
  isCorrect: boolean;
  feedback: string | null;
};

export function checkMultipleChoiceAnswer(
  content: MultipleChoiceStepContent,
  selectedIndex: number,
): AnswerResult {
  if (content.kind === "challenge") {
    const option = content.options[selectedIndex];
    if (!option) {
      return { feedback: null, isCorrect: false };
    }
    return { feedback: option.consequence, isCorrect: true };
  }

  const option = content.options[selectedIndex];
  if (!option) {
    return { feedback: null, isCorrect: false };
  }
  return { feedback: option.feedback, isCorrect: option.isCorrect };
}

export function checkFillBlankAnswer(
  content: FillBlankStepContent,
  userAnswers: string[],
): AnswerResult {
  const isSameLength = content.answers.length === userAnswers.length;
  const isCorrect =
    isSameLength &&
    content.answers.every(
      (answer, index) => answer.toLowerCase() === (userAnswers[index] ?? "").trim().toLowerCase(),
    );
  return { feedback: content.feedback, isCorrect };
}

export function checkSingleMatchPair(
  content: MatchColumnsStepContent,
  pair: { left: string; right: string },
): boolean {
  return content.pairs.some(
    (correct) => correct.left === pair.left && correct.right === pair.right,
  );
}

export function checkMatchColumnsAnswer(
  content: MatchColumnsStepContent,
  userPairs: { left: string; right: string }[],
  mistakes: number,
): AnswerResult {
  const allPairsCorrect =
    content.pairs.length === userPairs.length &&
    content.pairs.every((pair) =>
      userPairs.some((userPair) => userPair.left === pair.left && userPair.right === pair.right),
    );

  return { feedback: null, isCorrect: allPairsCorrect && mistakes === 0 };
}

export function checkSortOrderAnswer(
  content: SortOrderStepContent,
  userOrder: string[],
): AnswerResult {
  const isSameLength = content.items.length === userOrder.length;
  const isCorrect = isSameLength && content.items.every((item, index) => item === userOrder[index]);
  return { feedback: content.feedback, isCorrect };
}

export function checkSelectImageAnswer(
  content: SelectImageStepContent,
  selectedIndex: number,
): AnswerResult {
  const option = content.options[selectedIndex];
  if (!option) {
    return { feedback: null, isCorrect: false };
  }
  return { feedback: option.feedback, isCorrect: option.isCorrect };
}

export function checkVocabularyAnswer(correctWordId: string, selectedWordId: string): AnswerResult {
  return { feedback: null, isCorrect: correctWordId === selectedWordId };
}

export function checkArrangeWordsAnswer(correctWords: string[], userWords: string[]): AnswerResult {
  const isSameLength = correctWords.length === userWords.length;
  const isCorrect = isSameLength && correctWords.every((word, index) => word === userWords[index]);
  return { feedback: null, isCorrect };
}
