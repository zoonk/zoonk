import { type StepKind } from "@zoonk/db";
import { segmentWords } from "@zoonk/utils/string";
import { parseStepContent } from "../../steps/contract/content";
import { buildAcceptedArrangeWordSequences } from "./arrange-words-answers";
import {
  type AnswerResult,
  checkArrangeWordsAnswer,
  checkFillBlankAnswer,
  checkMatchColumnsAnswer,
  checkMultipleChoiceAnswer,
  checkSelectImageAnswer,
  checkSortOrderAnswer,
  checkTranslationAnswer,
} from "./check-answer";
import { type SelectedAnswer } from "./completion-input-schema";

export type CheckableStep = {
  content: unknown;
  kind: StepKind;
  sentence?: { explanation?: string | null; sentence: string; translation: string } | null;
  word?: { id: string; word?: string } | null;
};

function checkMultipleChoiceStep(step: CheckableStep, answer: SelectedAnswer): AnswerResult | null {
  if (step.kind !== "multipleChoice" || answer.kind !== "multipleChoice") {
    return null;
  }

  return checkMultipleChoiceAnswer(
    parseStepContent("multipleChoice", step.content),
    answer.selectedOptionId,
  );
}

function checkFillBlankStep(step: CheckableStep, answer: SelectedAnswer): AnswerResult | null {
  if (step.kind !== "fillBlank" || answer.kind !== "fillBlank") {
    return null;
  }

  return checkFillBlankAnswer(parseStepContent("fillBlank", step.content), answer.userAnswers);
}

function checkMatchColumnsStep(step: CheckableStep, answer: SelectedAnswer): AnswerResult | null {
  if (step.kind !== "matchColumns" || answer.kind !== "matchColumns") {
    return null;
  }

  return checkMatchColumnsAnswer(
    parseStepContent("matchColumns", step.content),
    answer.userPairs,
    answer.mistakes,
  );
}

function checkSortOrderStep(step: CheckableStep, answer: SelectedAnswer): AnswerResult | null {
  if (step.kind !== "sortOrder" || answer.kind !== "sortOrder") {
    return null;
  }

  return checkSortOrderAnswer(parseStepContent("sortOrder", step.content), answer.userOrder);
}

function checkSelectImageStep(step: CheckableStep, answer: SelectedAnswer): AnswerResult | null {
  if (step.kind !== "selectImage" || answer.kind !== "selectImage") {
    return null;
  }

  return checkSelectImageAnswer(
    parseStepContent("selectImage", step.content),
    answer.selectedOptionId,
  );
}

function checkTranslationStep(step: CheckableStep, answer: SelectedAnswer): AnswerResult | null {
  if (step.kind !== "translation" || answer.kind !== "translation" || !step.word) {
    return null;
  }

  return checkTranslationAnswer(step.word.id, answer.selectedOptionId, step.word.word);
}

function checkReadingStep(step: CheckableStep, answer: SelectedAnswer): AnswerResult | null {
  if (step.kind !== "reading" || answer.kind !== "reading" || !step.sentence) {
    return null;
  }

  const acceptedWords = buildAcceptedArrangeWordSequences(step.sentence.sentence, []);
  const result = checkArrangeWordsAnswer(acceptedWords, answer.arrangedWords);

  return {
    ...result,
    correctAnswer: segmentWords(step.sentence.sentence).join(" "),
    feedback: step.sentence.explanation ?? null,
  };
}

function checkListeningStep(step: CheckableStep, answer: SelectedAnswer): AnswerResult | null {
  if (step.kind !== "listening" || answer.kind !== "listening" || !step.sentence) {
    return null;
  }

  const acceptedWords = buildAcceptedArrangeWordSequences(step.sentence.translation, []);
  const result = checkArrangeWordsAnswer(acceptedWords, answer.arrangedWords);

  return {
    ...result,
    correctAnswer: segmentWords(step.sentence.translation).join(" "),
    feedback: step.sentence.explanation ?? null,
  };
}

export function checkStepAnswer(step: CheckableStep, answer: SelectedAnswer): AnswerResult | null {
  switch (step.kind) {
    case "fillBlank":
      return checkFillBlankStep(step, answer);
    case "listening":
      return checkListeningStep(step, answer);
    case "matchColumns":
      return checkMatchColumnsStep(step, answer);
    case "multipleChoice":
      return checkMultipleChoiceStep(step, answer);
    case "reading":
      return checkReadingStep(step, answer);
    case "selectImage":
      return checkSelectImageStep(step, answer);
    case "sortOrder":
      return checkSortOrderStep(step, answer);
    case "translation":
      return checkTranslationStep(step, answer);
    case "alphabet":
    case "arrangeWords":
    case "static":
    case "visual":
    case "vocabulary":
      return null;
    default:
      return null;
  }
}
