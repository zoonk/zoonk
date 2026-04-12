"use client";

import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-activity-data";
import { type SelectedAnswer, type StepResult } from "../player-reducer";
import { describePlayerStep } from "../player-step";
import { InvestigationActionVariant } from "./investigation-action-variant";
import { InvestigationCallVariant } from "./investigation-call-variant";
import { InvestigationProblemVariant } from "./investigation-problem-variant";

/**
 * Dispatches to the correct investigation variant component based
 * on the step's content variant (problem, action, call).
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
  const descriptor = describePlayerStep(step);

  if (descriptor?.kind === "investigationProblem") {
    return <InvestigationProblemVariant content={descriptor.content} />;
  }

  if (descriptor?.kind === "investigationAction") {
    return (
      <InvestigationActionVariant
        content={descriptor.content}
        onSelectAnswer={onSelectAnswer}
        result={result}
        selectedAnswer={selectedAnswer}
        step={step}
      />
    );
  }

  if (descriptor?.kind === "investigationCall") {
    return (
      <InvestigationCallVariant
        content={descriptor.content}
        onSelectAnswer={onSelectAnswer}
        result={result}
        selectedAnswer={selectedAnswer}
        step={step}
      />
    );
  }

  return null;
}
