import { type ChallengeEffect, parseStepContent } from "@zoonk/core/steps/content-contract";
import { segmentWords } from "@zoonk/utils/string";
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
import { type SelectedAnswer } from "./player-reducer";
import { type SerializedStep } from "./prepare-activity-data";

type CheckStepResult = {
  effects: ChallengeEffect[];
  result: AnswerResult;
};

const MISMATCH_RESULT: CheckStepResult = {
  effects: [],
  result: { correctAnswer: null, feedback: null, isCorrect: false },
};

function checkMultipleChoice(step: SerializedStep, answer: SelectedAnswer): CheckStepResult {
  if (answer.kind !== "multipleChoice") {
    return MISMATCH_RESULT;
  }

  const content = parseStepContent("multipleChoice", step.content);
  const result = checkMultipleChoiceAnswer(content, answer.selectedIndex);
  const effects =
    content.kind === "challenge" ? (content.options[answer.selectedIndex]?.effects ?? []) : [];

  return { effects, result };
}

function checkFillBlank(step: SerializedStep, answer: SelectedAnswer): CheckStepResult {
  if (answer.kind !== "fillBlank") {
    return MISMATCH_RESULT;
  }

  const content = parseStepContent("fillBlank", step.content);
  return { effects: [], result: checkFillBlankAnswer(content, answer.userAnswers) };
}

function checkMatchColumns(step: SerializedStep, answer: SelectedAnswer): CheckStepResult {
  if (answer.kind !== "matchColumns") {
    return MISMATCH_RESULT;
  }

  const content = parseStepContent("matchColumns", step.content);
  return {
    effects: [],
    result: checkMatchColumnsAnswer(content, answer.userPairs, answer.mistakes),
  };
}

function checkSortOrder(step: SerializedStep, answer: SelectedAnswer): CheckStepResult {
  if (answer.kind !== "sortOrder") {
    return MISMATCH_RESULT;
  }

  const content = parseStepContent("sortOrder", step.content);
  return { effects: [], result: checkSortOrderAnswer(content, answer.userOrder) };
}

function checkSelectImage(step: SerializedStep, answer: SelectedAnswer): CheckStepResult {
  if (answer.kind !== "selectImage") {
    return MISMATCH_RESULT;
  }

  const content = parseStepContent("selectImage", step.content);
  return { effects: [], result: checkSelectImageAnswer(content, answer.selectedIndex) };
}

function checkTranslationStep(step: SerializedStep, answer: SelectedAnswer): CheckStepResult {
  if (answer.kind !== "translation") {
    return MISMATCH_RESULT;
  }

  if (!step.word) {
    return MISMATCH_RESULT;
  }

  return {
    effects: [],
    result: checkTranslationAnswer(step.word.id, answer.selectedWordId, step.word.word),
  };
}

function checkArrangeWords(step: SerializedStep, arrangedWords: string[]): CheckStepResult {
  if (!step.sentence) {
    return MISMATCH_RESULT;
  }

  const words = segmentWords(step.sentence.sentence);
  return { effects: [], result: checkArrangeWordsAnswer(words, arrangedWords) };
}

function checkReadingStep(step: SerializedStep, answer: SelectedAnswer): CheckStepResult {
  if (answer.kind !== "reading") {
    return MISMATCH_RESULT;
  }

  return checkArrangeWords(step, answer.arrangedWords);
}

function checkListeningStep(step: SerializedStep, answer: SelectedAnswer): CheckStepResult {
  if (answer.kind !== "listening") {
    return MISMATCH_RESULT;
  }

  if (!step.sentence) {
    return MISMATCH_RESULT;
  }

  const words = segmentWords(step.sentence.translation);
  return { effects: [], result: checkArrangeWordsAnswer(words, answer.arrangedWords) };
}

export function checkStep(step: SerializedStep, answer: SelectedAnswer): CheckStepResult {
  switch (step.kind) {
    case "multipleChoice":
      return checkMultipleChoice(step, answer);

    case "fillBlank":
      return checkFillBlank(step, answer);

    case "matchColumns":
      return checkMatchColumns(step, answer);

    case "sortOrder":
      return checkSortOrder(step, answer);

    case "selectImage":
      return checkSelectImage(step, answer);

    case "translation":
      return checkTranslationStep(step, answer);

    case "reading":
      return checkReadingStep(step, answer);

    case "listening":
      return checkListeningStep(step, answer);

    case "static":
    case "visual":
    case "vocabulary":
      return MISMATCH_RESULT;

    default:
      return MISMATCH_RESULT;
  }
}
