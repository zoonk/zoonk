import { createStepStream } from "@/workflows/_shared/stream-status";
import { type StepVisualSchema, generateStepVisuals } from "@zoonk/ai/tasks/steps/visual";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { type ActivitySteps } from "./_utils/get-activity-steps";
import { buildVisualRows } from "./_utils/visual-rows";
import { type LessonActivity } from "./get-lesson-activities-step";

export type StepVisual = StepVisualSchema["visuals"][number];

export type VisualRow = {
  activityId: bigint | number;
  content: Omit<StepVisual, "stepIndex"> & { url?: string };
  isPublished: true;
  kind: "visual";
  position: number;
};

/**
 * Computes virtual "dbSteps" from the content step count.
 * Content steps are saved at positions `index * 2` (even positions),
 * so we recreate that mapping without reading the database.
 * Visual steps will be placed at `contentPosition + 1` (odd positions).
 */
function computeContentStepPositions(stepCount: number): { position: number }[] {
  return Array.from({ length: stepCount }, (_, i) => ({ position: i * 2 }));
}

/**
 * Generates visual content (code snippets, images, diagrams) for an explanation activity.
 * Pure data producer: computes visual positions from content step count instead of reading DB.
 * Returns visual rows ready for DB insertion. No DB writes happen here.
 * On failure, throws to let the workflow framework retry.
 */
export async function generateVisualsForActivityStep(
  activity: LessonActivity,
  steps: ActivitySteps,
): Promise<{ visuals: StepVisual[]; visualRows: VisualRow[] }> {
  "use step";

  await using stream = createStepStream<ActivityStepName>();

  if (steps.length === 0) {
    await stream.status({ status: "started", step: "generateVisuals" });
    await stream.status({ status: "completed", step: "generateVisuals" });
    return { visualRows: [], visuals: [] };
  }

  if (activity.generationStatus === "completed" || activity.generationStatus === "running") {
    return { visualRows: [], visuals: [] };
  }

  await stream.status({ status: "started", step: "generateVisuals" });

  const result = await generateStepVisuals({
    chapterTitle: activity.lesson.chapter.title,
    courseTitle: activity.lesson.chapter.course.title,
    language: activity.language,
    lessonDescription: activity.lesson.description ?? "",
    lessonTitle: activity.lesson.title,
    steps,
  });

  if (!result) {
    throw new Error("Empty AI result for visual generation");
  }

  const dbSteps = computeContentStepPositions(steps.length);

  const visualRows = buildVisualRows({
    activityId: activity.id,
    dbSteps,
    visuals: result.data.visuals,
  });

  if (!visualRows) {
    throw new Error("Invalid visual coverage — visuals don't match content step count");
  }

  await stream.status({ status: "completed", step: "generateVisuals" });

  return { visualRows, visuals: result.data.visuals };
}
