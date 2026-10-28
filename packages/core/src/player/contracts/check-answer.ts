import {
  type FillBlankStepContent,
  type MatchColumnsStepContent,
  type MultipleChoiceStepContent,
} from "../../library/steps/contract/language-exercises";
import { matchesAcceptedArrangeWords } from "./arrange-words-answers";

export type AnswerResult = {
  correctAnswer: string | null;
  isCorrect: boolean;
  feedback: string | null;
};

function getFillBlankCorrectAnswer(content: FillBlankStepContent): string {
  return content.template
    .split("[BLANK]")
    .map((segment, index) => `${segment}${content.answers[index] ?? ""}`)
    .join("");
}

export function checkMultipleChoiceAnswer(
  content: MultipleChoiceStepContent,
  selectedOptionId: string,
): AnswerResult {
  const correctAnswer = content.options.find((opt) => opt.isCorrect)?.text ?? null;
  const option = content.options.find((item) => item.id === selectedOptionId);

  if (!option) {
    return { correctAnswer, feedback: null, isCorrect: false };
  }

  return { correctAnswer, feedback: option.feedback, isCorrect: option.isCorrect };
}

export function checkFillBlankAnswer(
  content: FillBlankStepContent,
  userAnswers: string[],
): AnswerResult {
  const correctAnswer = getFillBlankCorrectAnswer(content);
  const isSameLength = content.answers.length === userAnswers.length;

  const isCorrect =
    isSameLength &&
    content.answers.every(
      (answer, index) => answer.toLowerCase() === (userAnswers[index] ?? "").trim().toLowerCase(),
    );

  return { correctAnswer, feedback: content.feedback, isCorrect };
}

export function checkSingleMatchPair(
  content: MatchColumnsStepContent,
  pair: { left: string; right: string },
): boolean {
  return content.pairs.some(
    (correct) => correct.left === pair.left && correct.right === pair.right,
  );
}

/** Duplicate label pairs are valid; JSON keys preserve multiplicity without delimiter collisions. */
function getSortedMatchPairKeys(pairs: { left: string; right: string }[]): string[] {
  return pairs.map((pair) => JSON.stringify([pair.left, pair.right])).toSorted();
}

function hasSameMatchPairCounts({
  correctPairs,
  userPairs,
}: {
  correctPairs: { left: string; right: string }[];
  userPairs: { left: string; right: string }[];
}): boolean {
  const correctKeys = getSortedMatchPairKeys(correctPairs);
  const userKeys = getSortedMatchPairKeys(userPairs);

  return (
    correctKeys.length === userKeys.length &&
    correctKeys.every((key, index) => key === userKeys[index])
  );
}

export function checkMatchColumnsAnswer(
  content: MatchColumnsStepContent,
  userPairs: { left: string; right: string }[],
  mistakes: number,
): AnswerResult {
  /** Every pair is solved before submission, so mistakes must still invalidate an otherwise complete board. */
  const isCorrect =
    mistakes === 0 && hasSameMatchPairCounts({ correctPairs: content.pairs, userPairs });

  return { correctAnswer: null, feedback: null, isCorrect };
}

export function checkTranslationAnswer(
  correctWordId: string,
  selectedOptionId: string,
  correctWord?: string,
): AnswerResult {
  return {
    correctAnswer: correctWord ?? null,
    feedback: null,
    isCorrect: correctWordId === selectedOptionId,
  };
}

export function checkArrangeWordsAnswer(
  correctWords: string[][],
  userWords: string[],
): AnswerResult {
  const isCorrect = matchesAcceptedArrangeWords(correctWords, userWords);
  return { correctAnswer: null, feedback: null, isCorrect };
}
