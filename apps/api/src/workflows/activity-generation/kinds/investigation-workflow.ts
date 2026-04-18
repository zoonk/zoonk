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

  const { activityId, scenario, title } =
    await generateInvestigationScenarioStep(activitiesToGenerate);

  if (!activityId || !scenario || !title) {
    return;
  }

  const activity = activitiesToGenerate.find((a) => a.id === activityId);

  if (!activity) {
    return;
  }

  const accuracy = await generateInvestigationAccuracyStep({
    activity,
    activityId,
    scenario,
  });

  if (!accuracy) {
    return;
  }

  const actions = await generateInvestigationActionsStep({
    accuracy,
    activityId,
    language: activity.language,
    scenario,
  });

  if (!actions) {
    return;
  }

  const findings = await generateInvestigationFindingsStep({
    accuracy,
    actions,
    activityId,
    language: activity.language,
    scenario,
  });

  if (!findings) {
    return;
  }

  await saveInvestigationActivityStep({
    accuracy,
    actions,
    activityId,
    findings,
    scenario,
    title,
    workflowRunId,
  });
}
