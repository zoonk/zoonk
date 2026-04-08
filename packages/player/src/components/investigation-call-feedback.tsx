"use client";

import { parseStepContent } from "@zoonk/core/steps/contract/content";
import { type StepResult } from "../player-reducer";
import { type SerializedStep } from "../prepare-activity-data";
import { type Verdict, VerdictLabel } from "./verdict-label";

/**
 * Derives the verdict from the step content and the learner's answer.
 *
 * Looks up the selected explanation's accuracy tier ("best", "partial",
 * "wrong") from the step content to differentiate all three outcomes.
 * Falls back to binary correct/incorrect when the step data is
 * unavailable.
 */
function getCallVerdict({ result, step }: { result: StepResult; step?: SerializedStep }): Verdict {
  if (!step || result.answer?.kind !== "investigation" || result.answer.variant !== "call") {
    return result.result.isCorrect ? "correct" : "incorrect";
  }

  const content = parseStepContent("investigation", step.content);

  if (content.variant !== "call") {
    return result.result.isCorrect ? "correct" : "incorrect";
  }

  const { selectedExplanationId } = result.answer;
  const explanation = content.explanations.find((exp) => exp.id === selectedExplanationId);

  if (!explanation) {
    return "incorrect";
  }

  if (explanation.accuracy === "best") {
    return "correct";
  }

  if (explanation.accuracy === "partial") {
    return "partial";
  }

  return "incorrect";
}

/**
 * Dedicated feedback screen for the investigation call step.
 *
 * Shows a verdict (correct/close/not quite) followed by the full
 * explanation of what actually happened. Differentiates all three
 * accuracy tiers so the learner knows how close their call was.
 *
 * Intentionally omits the evidence recap — the decision is
 * already made, so evidence is no longer useful here.
 */
export function InvestigationCallFeedbackContent({
  result,
  step,
}: {
  result: StepResult;
  step?: SerializedStep;
}) {
  const { feedback } = result.result;
  const verdict = getCallVerdict({ result, step });

  return (
    <div
      aria-live="polite"
      className="animate-in fade-in slide-in-from-bottom-1 mx-auto my-auto flex w-full max-w-lg flex-col gap-6 duration-200 ease-out motion-reduce:animate-none"
      role="status"
    >
      <VerdictLabel verdict={verdict} />

      {feedback && <p className="text-foreground text-lg leading-relaxed">{feedback}</p>}
    </div>
  );
}
