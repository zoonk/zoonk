import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-activity-data";
import { parseStepContent } from "@zoonk/core/steps/contract/content";
import { type StepResult } from "./player-reducer";

type InvestigationCallVerdict = "best" | "partial" | "wrong";

/**
 * Resolves how close the learner's investigation call was.
 *
 * The binary `isCorrect` flag is enough for most steps, but investigation
 * calls support a meaningful middle state (`partial`). This helper centralizes
 * that lookup so both tactile feedback and visual verdicts stay aligned.
 */
export function getInvestigationCallVerdict({
  result,
  step,
}: {
  result: StepResult;
  step?: SerializedStep | null;
}): InvestigationCallVerdict {
  const answer = result.answer;

  if (!step || answer?.kind !== "investigation" || answer.variant !== "call") {
    return result.result.isCorrect ? "best" : "wrong";
  }

  const content = parseStepContent("investigation", step.content);

  if (content.variant !== "call") {
    return result.result.isCorrect ? "best" : "wrong";
  }

  const explanation = content.explanations.find((item) => item.id === answer.selectedExplanationId);

  if (!explanation) {
    return "wrong";
  }

  if (explanation.accuracy === "best") {
    return "best";
  }

  if (explanation.accuracy === "partial") {
    return "partial";
  }

  return "wrong";
}
