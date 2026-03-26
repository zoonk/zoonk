import { createStepStream } from "@/workflows/_shared/stream-status";
import { type StepVisualSchema, generateStepVisuals } from "@zoonk/ai/tasks/steps/visual";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { rejected, settledValues } from "@zoonk/utils/settled";
import { buildVisualRows } from "./_utils/visual-rows";
import { type CustomContentResult } from "./generate-custom-content-step";
import { type VisualRow } from "./generate-visuals-step";
import { type LessonActivity } from "./get-lesson-activities-step";

export type CustomVisualResult = {
  activityId: number;
  visuals: StepVisualSchema["visuals"][number][];
  visualRows: VisualRow[];
};

/**
 * Computes virtual content step positions without reading the database.
 * Content steps are saved at positions `index * 2` (even positions).
 */
function computeContentStepPositions(stepCount: number): { position: number }[] {
  return Array.from({ length: stepCount }, (_, i) => ({ position: i * 2 }));
}

/**
 * Generates visuals for a single custom activity.
 * Pure data producer: no DB writes. Throws on failure.
 */
async function generateVisualsForActivity(
  activity: LessonActivity,
  contentResult: CustomContentResult,
): Promise<CustomVisualResult> {
  const empty = { activityId: activity.id, visualRows: [], visuals: [] };

  if (contentResult.steps.length === 0) {
    return empty;
  }

  const result = await generateStepVisuals({
    chapterTitle: activity.lesson.chapter.title,
    courseTitle: activity.lesson.chapter.course.title,
    language: activity.language,
    lessonDescription: activity.lesson.description ?? "",
    lessonTitle: activity.lesson.title,
    steps: contentResult.steps,
  });

  if (!result) {
    throw new Error("Empty visual result for custom activity");
  }

  const dbSteps = computeContentStepPositions(contentResult.steps.length);

  const visualRows = buildVisualRows({
    activityId: activity.id,
    dbSteps,
    visuals: result.data.visuals,
  });

  if (!visualRows) {
    throw new Error("Invalid visual coverage for custom activity");
  }

  return { activityId: activity.id, visualRows, visuals: result.data.visuals };
}

/**
 * Generates visual content for all custom activities in parallel.
 * Pure data producer: computes positions from content step count instead of reading DB.
 * Returns visual rows ready for DB insertion. No DB writes happen here.
 */
export async function generateCustomVisualsStep(
  activities: LessonActivity[],
  customContentResults: CustomContentResult[],
): Promise<CustomVisualResult[]> {
  "use step";

  if (customContentResults.length === 0) {
    return [];
  }

  await using stream = createStepStream<ActivityStepName>();

  await stream.status({ status: "started", step: "generateVisuals" });

  const allSettled = await Promise.allSettled(
    customContentResults.map((contentResult) => {
      const activity = activities.find((act) => act.id === contentResult.activityId);
      if (!activity) {
        return Promise.resolve({
          activityId: contentResult.activityId,
          visualRows: [],
          visuals: [],
        });
      }
      return generateVisualsForActivity(activity, contentResult);
    }),
  );

  await stream.status({
    status: rejected(allSettled) ? "error" : "completed",
    step: "generateVisuals",
  });

  return settledValues(allSettled);
}
