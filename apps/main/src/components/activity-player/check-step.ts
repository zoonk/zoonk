import { type SerializedStep } from "@/data/activities/prepare-activity-data";
import {
  type AnswerResult,
  checkArrangeWordsAnswer,
  checkFillBlankAnswer,
  checkMatchColumnsAnswer,
  checkMultipleChoiceAnswer,
  checkSelectImageAnswer,
  checkSortOrderAnswer,
  checkVocabularyAnswer,
} from "@zoonk/core/player/check-answer";
import { type ChallengeEffect, parseStepContent } from "@zoonk/core/steps/content-contract";
import { type SelectedAnswer } from "./player-reducer";

export type CheckStepResult = {
  effects: ChallengeEffect[];
  result: AnswerResult;
};

const MISMATCH_RESULT: CheckStepResult = {
  effects: [],
  result: { feedback: null, isCorrect: false },
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

function checkVocabularyStep(step: SerializedStep, answer: SelectedAnswer): CheckStepResult {
  if (answer.kind !== "vocabulary") {
    return MISMATCH_RESULT;
  }

  if (!step.word) {
    return MISMATCH_RESULT;
  }

  return { effects: [], result: checkVocabularyAnswer(step.word.id, answer.selectedWordId) };
}

function checkArrangeWords(step: SerializedStep, arrangedWords: string[]): CheckStepResult {
  if (!step.sentence) {
    return MISMATCH_RESULT;
  }

  const words = step.sentence.sentence.split(" ");
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

  return checkArrangeWords(step, answer.arrangedWords);
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

    case "vocabulary":
      return checkVocabularyStep(step, answer);

    case "reading":
      return checkReadingStep(step, answer);

    case "listening":
      return checkListeningStep(step, answer);

    case "static":
      return MISMATCH_RESULT;

    default:
      return MISMATCH_RESULT;
  }
}
