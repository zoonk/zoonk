import { type ExplanationResult } from "../generate-explanation-content-step";
import { type ActivitySteps } from "./get-activity-steps";

/**
 * Returns the slice of explanation steps that a specific practice
 * activity should use for its content generation.
 *
 * When there's only one practice, it gets all explanation steps.
 * When there are two practices (4+ concepts), the first practice
 * gets the first half of explanation results and the second gets
 * the rest.
 *
 * Example with 5 explanation results and 2 practices:
 *   - Practice 0: explanationResults[0..1]  (first 2)
 *   - Practice 1: explanationResults[2..4]  (last 3)
 */
export function getExplanationStepsForPractice(
  explanationResults: ExplanationResult[],
  practiceIndex: number,
  totalPractices: number,
): ActivitySteps {
  if (totalPractices <= 1) {
    return explanationResults.flatMap((result) => result.steps);
  }

  const splitIndex = Math.max(1, Math.floor(explanationResults.length / 2));

  const group =
    practiceIndex === 0
      ? explanationResults.slice(0, splitIndex)
      : explanationResults.slice(splitIndex);

  return group.flatMap((result) => result.steps);
}
