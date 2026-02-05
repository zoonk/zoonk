import { type ActivityKind } from "@zoonk/db";
import { ACTIVITY_DEPENDENCIES, getActivityHookToken } from "../../activity-dependency-graph";
import { activityContentCompletedHook } from "../../activity-hooks";
import { streamStatus } from "../../stream-status";
import { type ActivitySteps, getActivitySteps } from "../_utils/get-activity-steps";
import { type LessonActivity } from "../get-lesson-activities-step";

/**
 * Gets the content (steps) from a dependency activity.
 * If the dependency is already complete, fetches from DB.
 * If not complete, waits for the hook (workflow suspends with no resource usage).
 *
 * @returns The dependency's steps, or empty array if dependency doesn't exist
 */
export async function getDependencyContentStep(params: {
  activities: LessonActivity[];
  lessonId: number;
  dependencyKind: ActivityKind;
}): Promise<ActivitySteps> {
  "use step";

  await streamStatus({ status: "started", step: "getDependencyContent" });

  const dependency = params.activities.find((a) => a.kind === params.dependencyKind);

  // No dependency activity exists - check if this is expected
  if (!dependency) {
    const expectedDeps = ACTIVITY_DEPENDENCIES[params.dependencyKind];
    if (expectedDeps && expectedDeps.length > 0) {
      // Dependency was expected but not found - return empty to skip
      await streamStatus({ status: "completed", step: "getDependencyContent" });
      return [];
    }
    await streamStatus({ status: "completed", step: "getDependencyContent" });
    return [];
  }

  // Already completed - get from DB
  if (dependency.generationStatus === "completed" && dependency._count.steps > 0) {
    const steps = await getActivitySteps(dependency.id);
    await streamStatus({ status: "completed", step: "getDependencyContent" });
    return steps;
  }

  // Wait for hook - workflow SUSPENDS here (no resources consumed)
  const token = getActivityHookToken(params.dependencyKind, params.lessonId);
  const hook = activityContentCompletedHook.create({ token });

  const result = await hook;

  await streamStatus({ status: "completed", step: "getDependencyContent" });

  return result.steps;
}
