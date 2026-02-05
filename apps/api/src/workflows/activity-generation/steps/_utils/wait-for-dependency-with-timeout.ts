import { type ActivityKind } from "@zoonk/db";
import { sleep } from "workflow";
import { getDependencyContentStep } from "../_shared/get-dependency-content-step";
import { type LessonActivity } from "../get-lesson-activities-step";
import { type ActivitySteps } from "./get-activity-steps";

/**
 * Waits for a dependency's content with a 10-minute timeout.
 * Uses Promise.race to prevent infinite hanging on hook waits.
 *
 * Note: This must be called from a workflow function (not a step) because
 * sleep() can only be called in workflow functions.
 */
export function waitForDependencyWithTimeout(params: {
  activities: LessonActivity[];
  dependencyKind: ActivityKind;
  lessonId: number;
}): Promise<ActivitySteps> {
  return Promise.race([
    getDependencyContentStep(params),
    sleep("10m").then(() => {
      console.error(`Dependency ${params.dependencyKind} timed out for lesson ${params.lessonId}`);
      return [];
    }),
  ]);
}
