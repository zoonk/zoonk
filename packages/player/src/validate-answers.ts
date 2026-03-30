import {
  type SupportedStepKind,
  isSupportedStepKind,
  parseStepContent,
} from "@zoonk/core/steps/content-contract";
import { buildAcceptedArrangeWordSequences } from "./arrange-words-answers";
import {
  checkArrangeWordsAnswer,
  checkFillBlankAnswer,
  checkMatchColumnsAnswer,
  checkMultipleChoiceAnswer,
  checkSelectImageAnswer,
  checkSortOrderAnswer,
  checkTranslationAnswer,
} from "./check-answer";

type SelectedAnswer =
  | { kind: "fillBlank"; userAnswers: string[] }
  | { kind: "listening"; arrangedWords: string[] }
  | { kind: "matchColumns"; userPairs: { left: string; right: string }[]; mistakes: number }
  | { kind: "multipleChoice"; selectedIndex: number; selectedText: string }
  | { kind: "reading"; arrangedWords: string[] }
  | { kind: "selectImage"; selectedIndex: number }
  | { kind: "sortOrder"; userOrder: string[] }
  | { kind: "translation"; selectedWordId: string; selectedText: string; questionText: string };

/**
 * Step data for server-side validation. Translations live directly
 * on LessonWord/LessonSentence rather than in a separate translation
 * table, so sentence carries only the canonical translation string used
 * by listening validation.
 */
type StepData = {
  id: bigint;
  kind: string;
  content: unknown;
  word?: { id: bigint } | null;
  sentence?: {
    id: bigint;
    sentence: string;
    translation: string;
  } | null;
};

type ValidatedStepResult = {
  answer: object;
  isCorrect: boolean;
  stepId: bigint;
};

function validateMultipleChoice(
  step: StepData,
  answer: SelectedAnswer,
): ValidatedStepResult | null {
  if (answer.kind !== "multipleChoice") {
    return null;
  }

  const content = parseStepContent("multipleChoice", step.content);
  const index = content.options.findIndex((option) => option.text === answer.selectedText);

  if (index === -1) {
    return { answer, isCorrect: false, stepId: step.id };
  }

  const result = checkMultipleChoiceAnswer(content, index);

  return { answer, isCorrect: result.isCorrect, stepId: step.id };
}

function validateFillBlank(step: StepData, answer: SelectedAnswer): ValidatedStepResult | null {
  if (answer.kind !== "fillBlank") {
    return null;
  }

  const content = parseStepContent("fillBlank", step.content);
  const result = checkFillBlankAnswer(content, answer.userAnswers);
  return { answer, isCorrect: result.isCorrect, stepId: step.id };
}

function validateMatchColumns(step: StepData, answer: SelectedAnswer): ValidatedStepResult | null {
  if (answer.kind !== "matchColumns") {
    return null;
  }

  const content = parseStepContent("matchColumns", step.content);
  const result = checkMatchColumnsAnswer(content, answer.userPairs, answer.mistakes);
  return { answer, isCorrect: result.isCorrect, stepId: step.id };
}

function validateSortOrder(step: StepData, answer: SelectedAnswer): ValidatedStepResult | null {
  if (answer.kind !== "sortOrder") {
    return null;
  }

  const content = parseStepContent("sortOrder", step.content);
  const result = checkSortOrderAnswer(content, answer.userOrder);
  return { answer, isCorrect: result.isCorrect, stepId: step.id };
}

function validateSelectImage(step: StepData, answer: SelectedAnswer): ValidatedStepResult | null {
  if (answer.kind !== "selectImage") {
    return null;
  }

  const content = parseStepContent("selectImage", step.content);
  const result = checkSelectImageAnswer(content, answer.selectedIndex);
  return { answer, isCorrect: result.isCorrect, stepId: step.id };
}

function validateTranslation(step: StepData, answer: SelectedAnswer): ValidatedStepResult | null {
  if (answer.kind !== "translation") {
    return null;
  }

  if (!step.word) {
    return null;
  }

  const result = checkTranslationAnswer(String(step.word.id), answer.selectedWordId);
  return { answer, isCorrect: result.isCorrect, stepId: step.id };
}

function validateReading(step: StepData, answer: SelectedAnswer): ValidatedStepResult | null {
  if (answer.kind !== "reading") {
    return null;
  }

  if (!step.sentence) {
    return null;
  }

  const acceptedWordSequences = buildAcceptedArrangeWordSequences(step.sentence.sentence, []);
  const result = checkArrangeWordsAnswer(acceptedWordSequences, answer.arrangedWords);
  return { answer, isCorrect: result.isCorrect, stepId: step.id };
}

function validateListening(step: StepData, answer: SelectedAnswer): ValidatedStepResult | null {
  if (answer.kind !== "listening") {
    return null;
  }

  if (!step.sentence) {
    return null;
  }

  const acceptedWordSequences = buildAcceptedArrangeWordSequences(step.sentence.translation, []);
  const result = checkArrangeWordsAnswer(acceptedWordSequences, answer.arrangedWords);
  return { answer, isCorrect: result.isCorrect, stepId: step.id };
}

const validators: Record<
  SupportedStepKind,
  (step: StepData, answer: SelectedAnswer) => ValidatedStepResult | null
> = {
  fillBlank: validateFillBlank,
  listening: validateListening,
  matchColumns: validateMatchColumns,
  multipleChoice: validateMultipleChoice,
  reading: validateReading,
  selectImage: validateSelectImage,
  sortOrder: validateSortOrder,
  static: () => null,
  translation: validateTranslation,
  visual: () => null,
  vocabulary: () => null,
};

export function validateAnswers(
  steps: StepData[],
  clientAnswers: Record<string, SelectedAnswer>,
): ValidatedStepResult[] {
  return steps.flatMap((step) => {
    const answer = clientAnswers[String(step.id)];

    if (!answer || !isSupportedStepKind(step.kind)) {
      return [];
    }

    const validator = validators[step.kind];
    const result = validator(step, answer);
    return result ? [result] : [];
  });
}
