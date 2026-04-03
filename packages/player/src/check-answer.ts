import {
  type FillBlankStepContent,
  type MatchColumnsStepContent,
  type MultipleChoiceStepContent,
  type SelectImageStepContent,
  type SortOrderStepContent,
  type StoryStepContent,
} from "@zoonk/core/steps/contract/content";
import { matchesAcceptedArrangeWords } from "./arrange-words-answers";

export type AnswerResult = {
  correctAnswer: string | null;
  isCorrect: boolean;
  feedback: string | null;
};

export function checkMultipleChoiceAnswer(
  content: MultipleChoiceStepContent,
  selectedIndex: number,
): AnswerResult {
  const correctAnswer = content.options.find((opt) => opt.isCorrect)?.text ?? null;
  const option = content.options[selectedIndex];
  if (!option) {
    return { correctAnswer, feedback: null, isCorrect: false };
  }
  return { correctAnswer, feedback: option.feedback, isCorrect: option.isCorrect };
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
  return { correctAnswer: null, feedback: content.feedback, isCorrect };
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

  return { correctAnswer: null, feedback: null, isCorrect: allPairsCorrect && mistakes === 0 };
}

export function checkSortOrderAnswer(
  content: SortOrderStepContent,
  userOrder: string[],
): AnswerResult {
  const isSameLength = content.items.length === userOrder.length;
  const isCorrect = isSameLength && content.items.every((item, index) => item === userOrder[index]);
  return { correctAnswer: null, feedback: content.feedback, isCorrect };
}

export function checkSelectImageAnswer(
  content: SelectImageStepContent,
  selectedIndex: number,
): AnswerResult {
  const option = content.options[selectedIndex];
  if (!option) {
    return { correctAnswer: null, feedback: null, isCorrect: false };
  }
  return { correctAnswer: null, feedback: option.feedback, isCorrect: option.isCorrect };
}

export function checkTranslationAnswer(
  correctWordId: string,
  selectedWordId: string,
  correctWord?: string,
): AnswerResult {
  return {
    correctAnswer: correctWord ?? null,
    feedback: null,
    isCorrect: correctWordId === selectedWordId,
  };
}

/**
 * Check a story answer by looking up the selected choice's alignment.
 *
 * Alignment is hidden from the player during play, but determines correctness
 * for analytics/metrics: strong and partial count as correct, weak as incorrect.
 * The choice's consequence text is returned as feedback for display on the
 * feedback screen — it describes what happens as a result of the player's decision.
 */
export function checkStoryAnswer(
  content: StoryStepContent,
  selectedChoiceId: string,
): AnswerResult {
  const choice = content.choices.find((option) => option.id === selectedChoiceId);
  const isCorrect = choice ? choice.alignment !== "weak" : false;
  return { correctAnswer: null, feedback: choice?.consequence ?? null, isCorrect };
}

export function checkArrangeWordsAnswer(
  correctWords: string[][],
  userWords: string[],
): AnswerResult {
  const isCorrect = matchesAcceptedArrangeWords(correctWords, userWords);
  return { correctAnswer: null, feedback: null, isCorrect };
}
