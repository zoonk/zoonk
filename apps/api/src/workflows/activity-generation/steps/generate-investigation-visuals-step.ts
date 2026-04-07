import { createEntityStepStream } from "@/workflows/_shared/stream-status";
import {
  type ActivityInvestigationVisualSchema,
  generateInvestigationVisual,
} from "@zoonk/ai/tasks/activities/core/investigation-visuals";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { settledAll } from "@zoonk/utils/settled";
import { handleActivityFailureStep } from "./handle-failure-step";

type InvestigationVisualsResult = {
  scenarioVisual: ActivityInvestigationVisualSchema;
  findingVisuals: ActivityInvestigationVisualSchema[];
};

/**
 * Generates visual descriptions for the scenario and each finding.
 * Each call produces a visual kind (chart/code/diagram/etc.) and a
 * description for a separate system to generate the actual visual.
 *
 * Runs one call for the scenario (no finding param) and one per finding,
 * all in parallel. Returns null if any call fails.
 */
export async function generateInvestigationVisualsStep({
  activityId,
  findings,
  language,
  scenario,
}: {
  activityId: number;
  findings: string[];
  language: string;
  scenario: string;
}): Promise<InvestigationVisualsResult | null> {
  "use step";

  await using stream = createEntityStepStream<ActivityStepName>(activityId);

  await stream.status({ status: "started", step: "generateInvestigationVisuals" });

  const allCalls = [
    generateInvestigationVisual({ language, scenario }),
    ...findings.map((finding) => generateInvestigationVisual({ finding, language, scenario })),
  ];

  const results = await Promise.allSettled(allCalls);
  const fulfilled = settledAll(results);

  if (!fulfilled || fulfilled.length === 0) {
    await stream.error({ reason: "aiGenerationFailed", step: "generateInvestigationVisuals" });
    await handleActivityFailureStep({ activityId });
    return null;
  }

  const extracted = fulfilled.map((value) => value.data);
  const [scenarioVisual, ...findingVisuals] = extracted;

  if (!scenarioVisual) {
    await stream.error({ reason: "aiGenerationFailed", step: "generateInvestigationVisuals" });
    await handleActivityFailureStep({ activityId });
    return null;
  }

  await stream.status({ status: "completed", step: "generateInvestigationVisuals" });

  return { findingVisuals, scenarioVisual };
}
