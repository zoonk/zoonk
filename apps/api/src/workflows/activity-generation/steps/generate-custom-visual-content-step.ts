import { createStepStream } from "@/workflows/_shared/stream-status";
import { dispatchVisualContent } from "@zoonk/core/steps/dispatch-visual-content";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { rejected, settledValues } from "@zoonk/utils/settled";
import { type VisualStepRow, buildVisualStepRows } from "./_utils/visual-rows";
import { type CustomVisualDescriptionResult } from "./generate-custom-visuals-step";
import { type LessonActivity } from "./get-lesson-activities-step";

type CustomVisualContentResult = {
  activityId: number;
  completedRows: VisualStepRow[];
};

/**
 * Dispatches visual descriptions to per-kind tasks for a single custom activity.
 * Pure data producer: no DB writes. Throws on failure.
 */
async function dispatchVisualsForActivity(
  activity: LessonActivity,
  descriptionResult: CustomVisualDescriptionResult,
): Promise<CustomVisualContentResult> {
  if (descriptionResult.descriptions.length === 0) {
    return { activityId: activity.id, completedRows: [] };
  }

  const visuals = await dispatchVisualContent({
    descriptions: descriptionResult.descriptions,
    language: activity.language,
    orgSlug: activity.lesson.chapter.course.organization?.slug,
  });

  const completedRows = buildVisualStepRows({ activityId: activity.id, visuals });

  return { activityId: activity.id, completedRows };
}

/**
 * Dispatches visual descriptions to per-kind generation tasks for
 * all custom activities in parallel. This is stage 2 of the two-stage
 * visual pipeline.
 *
 * For image kinds, this also generates and uploads the actual image —
 * so there is no separate image generation step.
 *
 * Pure data producer: no DB writes happen here.
 */
export async function generateCustomVisualContentStep(
  activities: LessonActivity[],
  descriptionResults: CustomVisualDescriptionResult[],
): Promise<CustomVisualContentResult[]> {
  "use step";

  if (descriptionResults.length === 0) {
    return [];
  }

  await using stream = createStepStream<ActivityStepName>();

  await stream.status({ status: "started", step: "generateVisualContent" });

  const allSettled = await Promise.allSettled(
    descriptionResults.map((descriptionResult) => {
      const activity = activities.find((act) => act.id === descriptionResult.activityId);
      if (!activity) {
        return Promise.resolve({
          activityId: descriptionResult.activityId,
          completedRows: [],
        });
      }
      return dispatchVisualsForActivity(activity, descriptionResult);
    }),
  );

  await stream.status({
    status: rejected(allSettled) ? "error" : "completed",
    step: "generateVisualContent",
  });

  return settledValues(allSettled);
}
