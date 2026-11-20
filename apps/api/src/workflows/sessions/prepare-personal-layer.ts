import { getWorkflowMetadata } from "workflow";
import { type ContentAnalytics } from "../_shared/content-analytics";
import {
  listLessonFieldItemTargetsStep,
  prepareSkillFieldItems,
  readGoalField,
} from "../goals/steps/field-items-steps";
import { prepareExampleLines } from "./prepare-example-lines";
import { prepareFieldChallenge } from "./prepare-field-challenge";
import { prepareToolVersion } from "./prepare-tool-version";
import { listLearnerVersionTargetsStep } from "./steps/personal-versions-steps";

export async function preparePersonalLayer({
  analytics,
  goalId,
  lessonIds,
  userId,
}: {
  analytics: ContentAnalytics;
  goalId: string;
  lessonIds: string[];
  userId: string;
}) {
  const { workflowRunId } = getWorkflowMetadata();
  const context = { analytics, workflowRunId };
  const field = await readGoalField({ ...context, goalId });

  const [fieldItems, versions] = await Promise.all([
    field ? listLessonFieldItemTargetsStep({ field, lessonIds }) : [],
    listLearnerVersionTargetsStep({ goalId, lessonIds }),
  ]);

  await Promise.allSettled([
    ...fieldItems.map((target) => prepareSkillFieldItems({ ...context, target })),
    ...versions.tools.map((target) => prepareToolVersion({ ...context, target })),
    ...versions.challenges.map((target) => prepareFieldChallenge({ ...context, target })),
    prepareExampleLines({ lessonIds, userId }),
  ]);
}
