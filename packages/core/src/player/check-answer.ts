import {
  type FillBlankStepContent,
  type MatchColumnsStepContent,
  type MultipleChoiceStepContent,
  type SelectImageStepContent,
  type SortOrderStepContent,
} from "../steps/content-contract";

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
  const isCorrect = content.answers.every(
    (answer, index) => answer.toLowerCase() === (userAnswers[index] ?? "").trim().toLowerCase(),
  );
  return { feedback: content.feedback, isCorrect };
}

export function checkMatchColumnsAnswer(
  content: MatchColumnsStepContent,
  userPairs: { left: string; right: string }[],
): AnswerResult {
  if (content.pairs.length !== userPairs.length) {
    return { feedback: null, isCorrect: false };
  }

  const isCorrect = content.pairs.every((pair) =>
    userPairs.some((userPair) => userPair.left === pair.left && userPair.right === pair.right),
  );

  return { feedback: null, isCorrect };
}

export function checkSortOrderAnswer(
  content: SortOrderStepContent,
  userOrder: string[],
): AnswerResult {
  const isCorrect = content.items.every((item, index) => item === userOrder[index]);
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
  const isCorrect = correctWords.every((word, index) => word === userWords[index]);
  return { feedback: null, isCorrect };
}
