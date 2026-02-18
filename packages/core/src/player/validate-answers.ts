import {
  type ChallengeEffect,
  type SupportedStepKind,
  isSupportedStepKind,
  parseStepContent,
} from "../steps/content-contract";
import {
  checkArrangeWordsAnswer,
  checkFillBlankAnswer,
  checkMatchColumnsAnswer,
  checkMultipleChoiceAnswer,
  checkSelectImageAnswer,
  checkSortOrderAnswer,
  checkVocabularyAnswer,
} from "./check-answer";

type SelectedAnswer =
  | { kind: "fillBlank"; userAnswers: string[] }
  | { kind: "listening"; arrangedWords: string[] }
  | { kind: "matchColumns"; userPairs: { left: string; right: string }[]; mistakes: number }
  | { kind: "multipleChoice"; selectedIndex: number }
  | { kind: "reading"; arrangedWords: string[] }
  | { kind: "selectImage"; selectedIndex: number }
  | { kind: "sortOrder"; userOrder: string[] }
  | { kind: "vocabulary"; selectedWordId: string };

type StepData = {
  id: bigint;
  kind: string;
  content: unknown;
  word?: { id: bigint } | null;
  sentence?: { id: bigint; sentence: string; translation: string } | null;
};

export type ValidatedStepResult = {
  answer: object;
  effects: ChallengeEffect[];
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
  const result = checkMultipleChoiceAnswer(content, answer.selectedIndex);
  const effects =
    content.kind === "challenge" ? (content.options[answer.selectedIndex]?.effects ?? []) : [];

  return { answer, effects, isCorrect: result.isCorrect, stepId: step.id };
}

function validateFillBlank(step: StepData, answer: SelectedAnswer): ValidatedStepResult | null {
  if (answer.kind !== "fillBlank") {
    return null;
  }

  const content = parseStepContent("fillBlank", step.content);
  const result = checkFillBlankAnswer(content, answer.userAnswers);
  return { answer, effects: [], isCorrect: result.isCorrect, stepId: step.id };
}

function validateMatchColumns(step: StepData, answer: SelectedAnswer): ValidatedStepResult | null {
  if (answer.kind !== "matchColumns") {
    return null;
  }

  const content = parseStepContent("matchColumns", step.content);
  const result = checkMatchColumnsAnswer(content, answer.userPairs, answer.mistakes);
  return { answer, effects: [], isCorrect: result.isCorrect, stepId: step.id };
}

function validateSortOrder(step: StepData, answer: SelectedAnswer): ValidatedStepResult | null {
  if (answer.kind !== "sortOrder") {
    return null;
  }

  const content = parseStepContent("sortOrder", step.content);
  const result = checkSortOrderAnswer(content, answer.userOrder);
  return { answer, effects: [], isCorrect: result.isCorrect, stepId: step.id };
}

function validateSelectImage(step: StepData, answer: SelectedAnswer): ValidatedStepResult | null {
  if (answer.kind !== "selectImage") {
    return null;
  }

  const content = parseStepContent("selectImage", step.content);
  const result = checkSelectImageAnswer(content, answer.selectedIndex);
  return { answer, effects: [], isCorrect: result.isCorrect, stepId: step.id };
}

function validateVocabulary(step: StepData, answer: SelectedAnswer): ValidatedStepResult | null {
  if (answer.kind !== "vocabulary") {
    return null;
  }

  if (!step.word) {
    return null;
  }

  const result = checkVocabularyAnswer(String(step.word.id), answer.selectedWordId);
  return { answer, effects: [], isCorrect: result.isCorrect, stepId: step.id };
}

function validateReading(step: StepData, answer: SelectedAnswer): ValidatedStepResult | null {
  if (answer.kind !== "reading") {
    return null;
  }

  if (!step.sentence) {
    return null;
  }

  const words = step.sentence.sentence.split(" ");
  const result = checkArrangeWordsAnswer(words, answer.arrangedWords);
  return { answer, effects: [], isCorrect: result.isCorrect, stepId: step.id };
}

function validateListening(step: StepData, answer: SelectedAnswer): ValidatedStepResult | null {
  if (answer.kind !== "listening") {
    return null;
  }

  if (!step.sentence) {
    return null;
  }

  const words = step.sentence.translation.split(" ");
  const result = checkArrangeWordsAnswer(words, answer.arrangedWords);
  return { answer, effects: [], isCorrect: result.isCorrect, stepId: step.id };
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
  vocabulary: validateVocabulary,
};

export function validateAnswers(
  steps: StepData[],
  clientAnswers: Record<string, SelectedAnswer>,
): ValidatedStepResult[] {
  return steps
    .map((step) => {
      const answer = clientAnswers[String(step.id)];

      if (!answer) {
        return null;
      }

      if (!isSupportedStepKind(step.kind)) {
        return null;
      }

      const validator = validators[step.kind];
      return validator(step, answer);
    })
    .filter((result): result is ValidatedStepResult => result !== null);
}
