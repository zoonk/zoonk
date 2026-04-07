import { createEntityStepStream } from "@/workflows/_shared/stream-status";
import {
  type ActivityInvestigationInterpretationsSchema,
  generateActivityInvestigationInterpretations,
} from "@zoonk/ai/tasks/activities/core/investigation-interpretations";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { settledAll } from "@zoonk/utils/settled";
import { handleActivityFailureStep } from "./handle-failure-step";

/**
 * Reshapes a flat array of interpretation results into a 2D array
 * indexed by [findingIndex][explanationIndex]. The flat array is
 * ordered as: all explanations for finding 0, then all for finding 1, etc.
 */
function reshapeToGrid(
  flat: ActivityInvestigationInterpretationsSchema[],
  findingCount: number,
  explanationCount: number,
): ActivityInvestigationInterpretationsSchema[][] {
  return Array.from({ length: findingCount }, (_, findingIndex) =>
    flat.slice(findingIndex * explanationCount, (findingIndex + 1) * explanationCount),
  );
}

/**
 * Generates interpretation statements for every (finding, explanation) pair.
 * Each call produces 3 tiers (best/overclaims/dismissive) + feedback from
 * one explanation's perspective on one finding. Runs all calls in parallel
 * via Promise.allSettled.
 *
 * Returns a 2D array [findingIndex][explanationIndex] of interpretation sets,
 * or null if any call fails (all interpretations are required for the activity
 * to function correctly).
 */
export async function generateInvestigationInterpretationsStep({
  activityId,
  explanations,
  findings,
  language,
  scenario,
}: {
  activityId: number;
  explanations: string[];
  findings: string[];
  language: string;
  scenario: string;
}): Promise<ActivityInvestigationInterpretationsSchema[][] | null> {
  "use step";

  await using stream = createEntityStepStream<ActivityStepName>(activityId);

  await stream.status({ status: "started", step: "generateInvestigationInterpretations" });

  const calls = findings.flatMap((finding) =>
    explanations.map((explanation) =>
      generateActivityInvestigationInterpretations({
        explanation,
        finding,
        language,
        scenario,
      }),
    ),
  );

  const results = await Promise.allSettled(calls);
  const fulfilled = settledAll(results);

  if (!fulfilled) {
    await stream.error({
      reason: "aiGenerationFailed",
      step: "generateInvestigationInterpretations",
    });
    await handleActivityFailureStep({ activityId });
    return null;
  }

  await stream.status({ status: "completed", step: "generateInvestigationInterpretations" });

  const extracted = fulfilled.map((value) => value.data);
  return reshapeToGrid(extracted, findings.length, explanations.length);
}
