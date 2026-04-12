"use client";

import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-activity-data";
import { getInvestigationCallVerdict } from "../investigation-call-verdict";
import { type StepResult } from "../player-reducer";
import { PlayerFeedbackScene, PlayerFeedbackSceneMessage } from "./player-feedback-scene";
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
    <PlayerFeedbackScene>
      <VerdictLabel verdict={verdict} />

      {feedback && <PlayerFeedbackSceneMessage>{feedback}</PlayerFeedbackSceneMessage>}
    </PlayerFeedbackScene>
  );
}
