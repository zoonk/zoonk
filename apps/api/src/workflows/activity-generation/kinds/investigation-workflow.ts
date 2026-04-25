import { failActivityWorkflow } from "../handle-activity-workflow-error";
import { findActivityByKind } from "../steps/_utils/find-activity-by-kind";
import { generateInvestigationAccuracyStep } from "../steps/generate-investigation-accuracy-step";
import { generateInvestigationActionsStep } from "../steps/generate-investigation-actions-step";
import { generateInvestigationFindingsStep } from "../steps/generate-investigation-findings-step";
import { generateInvestigationScenarioStep } from "../steps/generate-investigation-scenario-step";
import { type LessonActivity } from "../steps/get-lesson-activities-step";
import { saveInvestigationActivityStep } from "../steps/save-investigation-activity-step";

/**
 * Orchestrates investigation activity generation.
 *
 * Sequential chain: scenario → accuracy → actions → findings → save
 *
 * The sequential chain is required because each task depends on
 * the output of the previous one. The accuracy task also produces
 * per-explanation feedback, replacing the former debrief step.
 *
 * Uses lesson concepts directly — investigation generation is
 * independent of explanation results, so it runs in wave 1
 * alongside explanations and stories.
 */
export async function investigationActivityWorkflow({
  activitiesToGenerate,
  workflowRunId,
}: {
  activitiesToGenerate: LessonActivity[];
  workflowRunId: string;
}): Promise<void> {
  "use workflow";

  const investigationActivity = findActivityByKind(activitiesToGenerate, "investigation");

  if (!investigationActivity) {
    return;
  }

  try {
    const { activityId, scenario, title } =
      await generateInvestigationScenarioStep(activitiesToGenerate);

    if (!activityId || !scenario || !title) {
      throw new Error("Investigation scenario step returned incomplete content");
    }

    const activity = activitiesToGenerate.find((a) => a.id === activityId);

    if (!activity) {
      throw new Error("Investigation scenario step returned an unknown activity id");
    }

    const accuracy = await generateInvestigationAccuracyStep({
      activity,
      activityId,
      scenario,
    });

    const actions = await generateInvestigationActionsStep({
      accuracy,
      activityId,
      language: activity.language,
      scenario,
    });

    const findings = await generateInvestigationFindingsStep({
      accuracy,
      actions,
      activityId,
      language: activity.language,
      scenario,
    });

    await saveInvestigationActivityStep({
      accuracy,
      actions,
      activityId,
      findings,
      scenario,
      title,
      workflowRunId,
    });
  } catch (error) {
    await failActivityWorkflow({ activityId: investigationActivity.id, error });
  }
}
