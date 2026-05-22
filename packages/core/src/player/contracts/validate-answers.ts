import { parseStepContent } from "@zoonk/core/steps/contract/content";
import { type StepKind } from "@zoonk/db";
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
import { type SelectedAnswer } from "./completion-input-schema";

/**
 * Step data for server-side validation. Translations live directly
 * on ChapterWord/ChapterSentence rather than in a separate translation
 * table, so sentence carries only the canonical translation string used
 * by listening validation.
 */
export type StepData = {
  id: string;
  kind: StepKind;
  content: unknown;
  word?: { id: string } | null;
  sentence?: { id: string; sentence: string; translation: string } | null;
};

type ValidatedStepResult = { answer: object; isCorrect: boolean; stepId: string };

export const ANSWERABLE_STEP_KINDS = [
  "fillBlank",
  "listening",
  "matchColumns",
  "multipleChoice",
  "reading",
  "selectImage",
  "sortOrder",
  "translation",
] as const satisfies readonly StepKind[];

type AnswerableStepKind = (typeof ANSWERABLE_STEP_KINDS)[number];
type ServerValidationBehavior = AnswerableStepKind | "none";

/**
 * Step kinds that share their database name with a validator can return that
 * name directly. This keeps non-answerable kinds such as alphabet, static,
 * vocabulary, and visual out of completion coverage without duplicating every
 * identity case in a switch.
 */
function isAnswerableStepKind(kind: StepKind): kind is AnswerableStepKind {
  return ANSWERABLE_STEP_KINDS.some((answerableKind) => answerableKind === kind);
}

/**
 * Server validation should follow the semantic step contract directly instead
 * of depending on the React player's render behavior table. The raw step kind
 * is enough to decide whether the submission should emit a StepAttempt.
 */
function getValidationBehavior(step: { kind: StepKind }): ServerValidationBehavior {
  if (isAnswerableStepKind(step.kind)) {
    return step.kind;
  }

  return "none";
}

function validateMultipleChoice(
  step: StepData,
  answer: SelectedAnswer,
): ValidatedStepResult | null {
  if (answer.kind !== "multipleChoice") {
    return null;
  }

  const content = parseStepContent("multipleChoice", step.content);
  const result = checkMultipleChoiceAnswer(content, answer.selectedOptionId);

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
  const result = checkSelectImageAnswer(content, answer.selectedOptionId);
  return { answer, isCorrect: result.isCorrect, stepId: step.id };
}

function validateTranslation(step: StepData, answer: SelectedAnswer): ValidatedStepResult | null {
  if (answer.kind !== "translation") {
    return null;
  }

  if (!step.word) {
    return null;
  }

  const result = checkTranslationAnswer(step.word.id, answer.selectedOptionId);
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
  ServerValidationBehavior,
  (step: StepData, answer: SelectedAnswer) => ValidatedStepResult | null
> = {
  fillBlank: validateFillBlank,
  listening: validateListening,
  matchColumns: validateMatchColumns,
  multipleChoice: validateMultipleChoice,
  none: () => null,
  reading: validateReading,
  selectImage: validateSelectImage,
  sortOrder: validateSortOrder,
  translation: validateTranslation,
};

/**
 * Completion persistence needs the same answerable-step definition as answer
 * validation. Keeping the count tied to the validation behavior table prevents
 * a new checked step kind from becoming completable without a submitted answer.
 */
export function countAnswerableSteps(steps: readonly { kind: StepKind }[]): number {
  return steps.filter((step) => getValidationBehavior(step) !== "none").length;
}

export function validateAnswers(
  steps: readonly StepData[],
  clientAnswers: Record<string, SelectedAnswer>,
): ValidatedStepResult[] {
  return steps.flatMap((step) => {
    const answer = clientAnswers[step.id];

    if (!answer) {
      return [];
    }

    const behavior = getValidationBehavior(step);

    if (!behavior || behavior === "none") {
      return [];
    }

    const validator = validators[behavior];
    const result = validator(step, answer);
    return result ? [result] : [];
  });
}
