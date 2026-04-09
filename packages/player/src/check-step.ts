import { parseStepContent } from "@zoonk/core/steps/contract/content";
import { segmentWords } from "@zoonk/utils/string";
import { buildAcceptedArrangeWordSequences } from "./arrange-words-answers";
import {
  type AnswerResult,
  checkArrangeWordsAnswer,
  checkFillBlankAnswer,
  checkInvestigationAction as checkInvestigationActionAnswer,
  checkInvestigationCall,
  checkMatchColumnsAnswer,
  checkMultipleChoiceAnswer,
  checkSelectImageAnswer,
  checkSortOrderAnswer,
  checkStoryAnswer,
  checkTranslationAnswer,
} from "./check-answer";
import { type SelectedAnswer } from "./player-reducer";
import { type PlayerCheckBehavior, getPlayerCheckBehavior } from "./player-step-behavior";
import { type SerializedStep } from "./prepare-activity-data";

type CheckStepResult = {
  result: AnswerResult;
};

const MISMATCH_RESULT: CheckStepResult = {
  result: { correctAnswer: null, feedback: null, isCorrect: false },
};

function checkMultipleChoice(step: SerializedStep, answer: SelectedAnswer): CheckStepResult {
  if (answer.kind !== "multipleChoice") {
    return MISMATCH_RESULT;
  }

  const content = parseStepContent("multipleChoice", step.content);
  const result = checkMultipleChoiceAnswer(content, answer.selectedIndex);

  return { result };
}

function checkFillBlank(step: SerializedStep, answer: SelectedAnswer): CheckStepResult {
  if (answer.kind !== "fillBlank") {
    return MISMATCH_RESULT;
  }

  const content = parseStepContent("fillBlank", step.content);
  return { result: checkFillBlankAnswer(content, answer.userAnswers) };
}

function checkMatchColumns(step: SerializedStep, answer: SelectedAnswer): CheckStepResult {
  if (answer.kind !== "matchColumns") {
    return MISMATCH_RESULT;
  }

  const content = parseStepContent("matchColumns", step.content);
  return {
    result: checkMatchColumnsAnswer(content, answer.userPairs, answer.mistakes),
  };
}

function checkSortOrder(step: SerializedStep, answer: SelectedAnswer): CheckStepResult {
  if (answer.kind !== "sortOrder") {
    return MISMATCH_RESULT;
  }

  const content = parseStepContent("sortOrder", step.content);
  return { result: checkSortOrderAnswer(content, answer.userOrder) };
}

function checkSelectImage(step: SerializedStep, answer: SelectedAnswer): CheckStepResult {
  if (answer.kind !== "selectImage") {
    return MISMATCH_RESULT;
  }

  const content = parseStepContent("selectImage", step.content);
  return { result: checkSelectImageAnswer(content, answer.selectedIndex) };
}

function checkTranslationStep(step: SerializedStep, answer: SelectedAnswer): CheckStepResult {
  if (answer.kind !== "translation") {
    return MISMATCH_RESULT;
  }

  if (!step.word) {
    return MISMATCH_RESULT;
  }

  return {
    result: checkTranslationAnswer(step.word.id, answer.selectedWordId, step.word.word),
  };
}

function checkReadingStep(step: SerializedStep, answer: SelectedAnswer): CheckStepResult {
  if (answer.kind !== "reading") {
    return MISMATCH_RESULT;
  }

  if (!step.sentence) {
    return MISMATCH_RESULT;
  }

  const words = segmentWords(step.sentence.sentence);
  const acceptedWordSequences = buildAcceptedArrangeWordSequences(step.sentence.sentence, []);
  const result = checkArrangeWordsAnswer(acceptedWordSequences, answer.arrangedWords);

  return {
    result: {
      ...result,
      correctAnswer: words.join(" "),
      feedback: step.sentence.explanation ?? null,
    },
  };
}

function checkListeningStep(step: SerializedStep, answer: SelectedAnswer): CheckStepResult {
  if (answer.kind !== "listening") {
    return MISMATCH_RESULT;
  }

  if (!step.sentence) {
    return MISMATCH_RESULT;
  }

  const words = segmentWords(step.sentence.translation);
  const acceptedWordSequences = buildAcceptedArrangeWordSequences(step.sentence.translation, []);
  const result = checkArrangeWordsAnswer(acceptedWordSequences, answer.arrangedWords);

  return {
    result: {
      ...result,
      correctAnswer: words.join(" "),
      feedback: step.sentence.explanation ?? null,
    },
  };
}

/**
 * Checks an investigation answer based on the step variant.
 *
 * - Problem: always correct (read-only step, no real answer)
 * - Action: correct unless weak quality (critical/useful = correct, weak = incorrect)
 * - Call: checks if the selected explanation has "best" accuracy
 */
function checkInvestigationProblem(step: SerializedStep, answer: SelectedAnswer): CheckStepResult {
  if (answer.kind !== "investigation" || answer.variant !== "problem") {
    return MISMATCH_RESULT;
  }

  const content = parseStepContent("investigation", step.content);

  if (content.variant !== "problem") {
    return MISMATCH_RESULT;
  }

  return { result: { correctAnswer: null, feedback: null, isCorrect: true } };
}

function checkInvestigationActionStep(
  step: SerializedStep,
  answer: SelectedAnswer,
): CheckStepResult {
  if (answer.kind !== "investigation") {
    return MISMATCH_RESULT;
  }

  const content = parseStepContent("investigation", step.content);

  if (content.variant !== "action" || answer.variant !== "action") {
    return MISMATCH_RESULT;
  }

  return {
    result: checkInvestigationActionAnswer(content, answer.selectedActionId),
  };
}

function checkInvestigationCallStep(step: SerializedStep, answer: SelectedAnswer): CheckStepResult {
  if (answer.kind !== "investigation") {
    return MISMATCH_RESULT;
  }

  const content = parseStepContent("investigation", step.content);

  if (content.variant !== "call" || answer.variant !== "call") {
    return MISMATCH_RESULT;
  }

  return {
    result: checkInvestigationCall(content, answer.selectedExplanationId),
  };
}

function checkStory(step: SerializedStep, answer: SelectedAnswer): CheckStepResult {
  if (answer.kind !== "story") {
    return MISMATCH_RESULT;
  }

  const content = parseStepContent("story", step.content);

  return { result: checkStoryAnswer(content, answer.selectedChoiceId) };
}

const CHECKERS: Record<
  PlayerCheckBehavior,
  (step: SerializedStep, answer: SelectedAnswer) => CheckStepResult
> = {
  fillBlank: checkFillBlank,
  investigationAction: checkInvestigationActionStep,
  investigationCall: checkInvestigationCallStep,
  investigationProblem: checkInvestigationProblem,
  listening: checkListeningStep,
  matchColumns: checkMatchColumns,
  multipleChoice: checkMultipleChoice,
  none: () => MISMATCH_RESULT,
  reading: checkReadingStep,
  selectImage: checkSelectImage,
  sortOrder: checkSortOrder,
  story: checkStory,
  translation: checkTranslationStep,
};

export function checkStep(step: SerializedStep, answer: SelectedAnswer): CheckStepResult {
  const behavior = getPlayerCheckBehavior(step) ?? "none";
  return CHECKERS[behavior](step, answer);
}
