import { type StepKind } from "@zoonk/db";
import { type CheckableStep, checkStepAnswer } from "./check-step-answer";
import { type SelectedAnswer } from "./completion-input-schema";

export type StepData = CheckableStep & { id: string };

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

function isAnswerableStepKind(kind: StepKind): kind is AnswerableStepKind {
  return ANSWERABLE_STEP_KINDS.some((answerableKind) => answerableKind === kind);
}

export function countAnswerableSteps(steps: readonly { kind: StepKind }[]): number {
  return steps.filter((step) => isAnswerableStepKind(step.kind)).length;
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

    const result = checkStepAnswer(step, answer);

    return result ? [{ answer, isCorrect: result.isCorrect, stepId: step.id }] : [];
  });
}
