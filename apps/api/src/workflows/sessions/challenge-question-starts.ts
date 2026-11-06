import { startOnce } from "../_shared/run-token";
import {
  challengeQuestionsWorkflow,
  getChallengeQuestionsToken,
} from "../goals/challenge-questions-workflow";
import { type PreparationDecision } from "./steps/preparation-decision-step";

export function startChallengeQuestions(
  decision: Extract<PreparationDecision, { status: "ready" }>,
): Promise<string>[] {
  const request = decision.challengeQuestions;

  if (!request) {
    return [];
  }

  const { analytics, challenges, quickFormat } = request;

  return challenges.map(({ key, later, writes }) =>
    startOnce(
      challengeQuestionsWorkflow,
      [{ analytics, goalId: decision.goalId, key, later, quickFormat, writes }],
      getChallengeQuestionsToken({ key }),
    ),
  );
}
