import { generateInvestigationAccuracyStep } from "../steps/generate-investigation-accuracy-step";
import { generateInvestigationActionsStep } from "../steps/generate-investigation-actions-step";
import { generateInvestigationDebriefStep } from "../steps/generate-investigation-debrief-step";
import { generateInvestigationFindingsStep } from "../steps/generate-investigation-findings-step";
import { generateInvestigationScenarioStep } from "../steps/generate-investigation-scenario-step";
import { type LessonActivity } from "../steps/get-lesson-activities-step";
import { saveInvestigationActivityStep } from "../steps/save-investigation-activity-step";

/**
 * Orchestrates investigation activity generation.
 *
 * Sequential chain: scenario → accuracy → actions → findings → debrief → save
 *
 * The sequential chain is required because each task depends on
 * the output of the previous one.
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

  const { activityId, scenario } = await generateInvestigationScenarioStep(activitiesToGenerate);

  if (!activityId || !scenario) {
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

  const debrief = await generateInvestigationDebriefStep({
    accuracy,
    actions,
    activityId,
    findings,
    language: activity.language,
    scenario,
  });

  if (!debrief) {
    return;
  }

  await saveInvestigationActivityStep({
    accuracy,
    actions,
    activityId,
    debrief,
    findings,
    scenario,
    workflowRunId,
  });
}
