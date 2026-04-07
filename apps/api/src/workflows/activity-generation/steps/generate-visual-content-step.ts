import { createEntityStepStream } from "@/workflows/_shared/stream-status";
import { type VisualDescription } from "@zoonk/ai/tasks/steps/visual-descriptions";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { dispatchVisualContent } from "./_utils/dispatch-visual-content";
import { type VisualStepRow, buildVisualStepRows } from "./_utils/visual-rows";
import { type LessonActivity } from "./get-lesson-activities-step";

/**
 * Dispatches visual descriptions to per-kind generation tasks (chart,
 * code, diagram, image, etc.) in parallel, then builds database-ready
 * visual rows. This is stage 2 of the two-stage visual pipeline.
 *
 * For image kinds, this also generates and uploads the actual image —
 * so there is no separate image generation step.
 *
 * Returns visual rows ready for DB insertion. No DB writes happen here.
 */
export async function generateVisualContentForActivityStep(
  activity: LessonActivity,
  descriptions: VisualDescription[],
): Promise<{ completedRows: VisualStepRow[]; hadFailure: boolean }> {
  "use step";

  await using stream = createEntityStepStream<ActivityStepName>(activity.id);

  if (descriptions.length === 0) {
    await stream.status({ status: "started", step: "generateVisualContent" });
    await stream.status({ status: "completed", step: "generateVisualContent" });
    return { completedRows: [], hadFailure: false };
  }

  await stream.status({ status: "started", step: "generateVisualContent" });

  const visuals = await dispatchVisualContent({
    descriptions,
    language: activity.language,
    orgSlug: activity.lesson.chapter.course.organization?.slug,
  });

  const completedRows = buildVisualStepRows({ activityId: activity.id, visuals });

  await stream.status({ status: "completed", step: "generateVisualContent" });

  return { completedRows, hadFailure: false };
}
