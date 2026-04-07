"use client";

import { parseStepContent } from "@zoonk/core/steps/contract/content";
import { type SelectedAnswer, type StepResult } from "../player-reducer";
import { type SerializedStep } from "../prepare-activity-data";
import { InvestigationActionVariant } from "./investigation-action-variant";
import { InvestigationCallVariant } from "./investigation-call-variant";
import { InvestigationEvidenceVariant } from "./investigation-evidence-variant";
import { InvestigationProblemVariant } from "./investigation-problem-variant";

/**
 * Dispatches to the correct investigation variant component based
 * on the step's content variant (problem, action, evidence, call).
 *
 * Each variant is a separate component to keep file sizes manageable
 * and avoid hooks being called after conditional returns.
 */
export function InvestigationStep({
  onSelectAnswer,
  result,
  selectedAnswer,
  step,
}: {
  onSelectAnswer: (stepId: string, answer: SelectedAnswer | null) => void;
  result?: StepResult;
  selectedAnswer: SelectedAnswer | undefined;
  step: SerializedStep;
}) {
  const content = parseStepContent("investigation", step.content);

  if (content.variant === "problem") {
    return (
      <InvestigationProblemVariant
        content={content}
        onSelectAnswer={onSelectAnswer}
        selectedAnswer={selectedAnswer}
        step={step}
      />
    );
  }

  if (content.variant === "action") {
    return (
      <InvestigationActionVariant
        content={content}
        onSelectAnswer={onSelectAnswer}
        selectedAnswer={selectedAnswer}
        step={step}
      />
    );
  }

  if (content.variant === "evidence") {
    return (
      <InvestigationEvidenceVariant
        content={content}
        onSelectAnswer={onSelectAnswer}
        result={result}
        selectedAnswer={selectedAnswer}
        step={step}
      />
    );
  }

  if (content.variant === "call") {
    return (
      <InvestigationCallVariant
        content={content}
        onSelectAnswer={onSelectAnswer}
        result={result}
        selectedAnswer={selectedAnswer}
        step={step}
      />
    );
  }

  return null;
}
