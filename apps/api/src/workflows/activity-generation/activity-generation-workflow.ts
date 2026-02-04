import { getWorkflowMetadata } from "workflow";
import { addStepsStep } from "./steps/add-steps-step";
import { generateBackgroundStep } from "./steps/generate-background-step";
import { generateVisualImagesStep } from "./steps/generate-visual-images-step";
import { generateVisualsStep } from "./steps/generate-visuals-step";
import { getActivityStep } from "./steps/get-activity-step";
import { handleActivityFailureStep } from "./steps/handle-failure-step";
import { setActivityAsCompletedStep } from "./steps/set-activity-as-completed-step";
import { setActivityAsRunningStep } from "./steps/set-activity-as-running-step";

export async function activityGenerationWorkflow(activityId: bigint): Promise<void> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();

  const context = await getActivityStep(activityId);

  if (context.generationStatus === "running") {
    return;
  }

  if (context.generationStatus === "completed" && context._count.steps > 0) {
    return;
  }

  // Only handle "background" activity kind for now
  // Other kinds will be implemented in future tasks
  if (context.kind !== "background") {
    return;
  }

  if (context._count.steps > 0) {
    await setActivityAsCompletedStep({ context, workflowRunId });
    return;
  }

  await setActivityAsRunningStep({ activityId: context.id, workflowRunId });

  try {
    const backgroundData = await generateBackgroundStep(context);
    const visuals = await generateVisualsStep(context, backgroundData.steps);
    const visualsWithUrls = await generateVisualImagesStep(context, visuals.visuals);

    await addStepsStep({
      context,
      steps: backgroundData.steps,
      visuals: visualsWithUrls,
    });

    await setActivityAsCompletedStep({ context, workflowRunId });
  } catch (error) {
    await handleActivityFailureStep({ activityId: context.id });
    throw error;
  }
}
