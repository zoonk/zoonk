import {
  type FillBlankStepContent,
  type InvestigationStepContent,
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
  selectedOptionId: string,
): AnswerResult {
  const option = content.options.find((item) => item.id === selectedOptionId);

  if (!option) {
    return { correctAnswer: null, feedback: null, isCorrect: false };
  }

  return { correctAnswer: null, feedback: option.feedback, isCorrect: option.isCorrect };
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

/**
 * Check a story answer by looking up the selected option's alignment.
 *
 * Alignment is hidden from the player during play, but determines correctness
 * for analytics/metrics: strong and partial count as correct, weak as incorrect.
 * The option's feedback text describes what happens as a result of the player's
 * decision and is returned for display on the feedback screen.
 */
export function checkStoryAnswer(
  content: StoryStepContent,
  selectedOptionId: string,
): AnswerResult {
  const option = content.options.find((item) => item.id === selectedOptionId);
  const isCorrect = option ? option.alignment !== "weak" : false;

  return { correctAnswer: null, feedback: option?.feedback ?? null, isCorrect };
}

export function checkArrangeWordsAnswer(
  correctWords: string[][],
  userWords: string[],
): AnswerResult {
  const isCorrect = matchesAcceptedArrangeWords(correctWords, userWords);
  return { correctAnswer: null, feedback: null, isCorrect };
}

/**
 * Checks an investigation action answer by quality tier.
 *
 * Critical and useful actions are correct (strong evidence choices).
 * Weak actions are incorrect (poor investigation decisions).
 * Returns the option feedback so the evidence can be shown
 * after checking.
 */
export function checkInvestigationAction(
  content: Extract<InvestigationStepContent, { variant: "action" }>,
  selectedOptionId: string,
): AnswerResult {
  const action = content.options.find((a) => a.id === selectedOptionId);

  if (!action) {
    return { correctAnswer: null, feedback: null, isCorrect: false };
  }

  return { correctAnswer: null, feedback: action.feedback, isCorrect: action.quality !== "weak" };
}

/**
 * Checks an investigation call (final answer) against the explanation's
 * accuracy tier.
 *
 * "best" is the correct explanation. "partial" gets partial credit in
 * scoring but counts as incorrect for the binary check. Returns the
 * selected explanation's feedback — each explanation has its own
 * message explaining why it's correct, partially right, or wrong.
 */
export function checkInvestigationCall(
  content: Extract<InvestigationStepContent, { variant: "call" }>,
  selectedOptionId: string,
): AnswerResult {
  const explanation = content.options.find((exp) => exp.id === selectedOptionId);

  if (!explanation) {
    return { correctAnswer: null, feedback: null, isCorrect: false };
  }

  const isCorrect = explanation.accuracy === "best";

  return { correctAnswer: null, feedback: explanation.feedback, isCorrect };
}
