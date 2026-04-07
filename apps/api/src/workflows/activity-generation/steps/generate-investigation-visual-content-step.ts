import { createEntityStepStream } from "@/workflows/_shared/stream-status";
import { type ActivityInvestigationVisualSchema } from "@zoonk/ai/tasks/activities/core/investigation-visuals";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { safeAsync } from "@zoonk/utils/error";
import { dispatchVisualContent } from "./_utils/dispatch-visual-content";
import { handleActivityFailureStep } from "./handle-failure-step";

type DispatchedVisual = { kind: string } & Record<string, unknown>;

type InvestigationVisualContentResult = {
  scenarioVisual: DispatchedVisual;
  findingVisuals: DispatchedVisual[];
};

/**
 * Dispatches investigation visual descriptions through the shared
 * visual content pipeline. Each description (scenario + findings)
 * is sent to the appropriate per-kind generator (chart, code, diagram,
 * etc.) to produce structured content or image URLs.
 *
 * The investigation visual AI task outputs { kind, description } which
 * matches the VisualDescription shape expected by dispatchVisualContent.
 *
 * Returns dispatched visuals in order (scenario first, then findings),
 * or null if dispatch fails.
 */
export async function generateInvestigationVisualContentStep({
  activityId,
  findingVisuals,
  language,
  scenarioVisual,
}: {
  activityId: number;
  findingVisuals: ActivityInvestigationVisualSchema[];
  language: string;
  scenarioVisual: ActivityInvestigationVisualSchema;
}): Promise<InvestigationVisualContentResult | null> {
  "use step";

  await using stream = createEntityStepStream<ActivityStepName>(activityId);

  await stream.status({ status: "started", step: "generateInvestigationVisualContent" });

  const allDescriptions = [scenarioVisual, ...findingVisuals];

  const { data: dispatched, error } = await safeAsync(() =>
    dispatchVisualContent({ descriptions: allDescriptions, language }),
  );

  if (error || !dispatched || dispatched.length !== allDescriptions.length) {
    await stream.error({
      reason: "aiGenerationFailed",
      step: "generateInvestigationVisualContent",
    });
    await handleActivityFailureStep({ activityId });
    return null;
  }

  await stream.status({ status: "completed", step: "generateInvestigationVisualContent" });

  const scenarioResult = dispatched[0];
  const findingResults = dispatched.slice(1);

  if (!scenarioResult) {
    await stream.error({
      reason: "aiGenerationFailed",
      step: "generateInvestigationVisualContent",
    });
    await handleActivityFailureStep({ activityId });
    return null;
  }

  return {
    findingVisuals: findingResults,
    scenarioVisual: scenarioResult,
  };
}
