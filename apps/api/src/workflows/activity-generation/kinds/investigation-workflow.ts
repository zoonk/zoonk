import { settled } from "@zoonk/utils/settled";
import { generateInvestigationAccuracyStep } from "../steps/generate-investigation-accuracy-step";
import { generateInvestigationActionsStep } from "../steps/generate-investigation-actions-step";
import { generateInvestigationDebriefStep } from "../steps/generate-investigation-debrief-step";
import { generateInvestigationFindingsStep } from "../steps/generate-investigation-findings-step";
import { generateInvestigationScenarioStep } from "../steps/generate-investigation-scenario-step";
import { generateInvestigationVisualContentStep } from "../steps/generate-investigation-visual-content-step";
import { generateInvestigationVisualsStep } from "../steps/generate-investigation-visuals-step";
import { type LessonActivity } from "../steps/get-lesson-activities-step";
import { handleActivityFailureStep } from "../steps/handle-failure-step";
import { saveInvestigationActivityStep } from "../steps/save-investigation-activity-step";

/**
 * Orchestrates investigation activity generation.
 *
 * Sequential chain: scenario → accuracy → actions → findings
 * Parallel tier: debrief + visual descriptions
 * Then: visual content dispatch → save
 *
 * The sequential chain is required because each task depends on
 * the output of the previous one. After findings, two tasks
 * run in parallel since they only read from completed data.
 * Visual content dispatch depends on visual descriptions, so it
 * runs after the parallel tier completes.
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

  const [debriefResult, visualsResult] = await Promise.allSettled([
    generateInvestigationDebriefStep({
      accuracy,
      actions,
      activityId,
      findings,
      language: activity.language,
      scenario,
    }),
    generateInvestigationVisualsStep({
      activityId,
      findings: findings.findings,
      language: activity.language,
      scenario: scenario.scenario,
    }),
  ]);

  const debrief = settled(debriefResult, null);
  const visuals = settled(visualsResult, null);

  if (!debrief || !visuals) {
    await handleActivityFailureStep({ activityId });
    return;
  }

  const visualContent = await generateInvestigationVisualContentStep({
    activityId,
    findingVisuals: visuals.findingVisuals,
    language: activity.language,
    orgSlug: activity.lesson.chapter.course.organization?.slug,
    scenarioVisual: visuals.scenarioVisual,
  });

  if (!visualContent) {
    return;
  }

  await saveInvestigationActivityStep({
    accuracy,
    actions,
    activityId,
    debrief,
    findingVisuals: visualContent.findingVisuals,
    findings,
    scenario,
    scenarioVisual: visualContent.scenarioVisual,
    workflowRunId,
  });
}
