"use client";

import { getInvestigationCallVerdict } from "../investigation-call-verdict";
import { type StepResult } from "../player-reducer";
import { type SerializedStep } from "../prepare-activity-data";
import { type Verdict, VerdictLabel } from "./verdict-label";

/** Maps investigation call accuracy to the shared UI verdict vocabulary. */
function getCallVerdict({ result, step }: { result: StepResult; step?: SerializedStep }): Verdict {
  const verdict = getInvestigationCallVerdict({ result, step });

  if (verdict === "best") {
    return "correct";
  }

  if (verdict === "partial") {
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
