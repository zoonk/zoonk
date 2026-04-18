import { createEntityStepStream } from "@/workflows/_shared/stream-status";
import { type VisualDescription } from "@zoonk/ai/tasks/steps/visual-descriptions";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { dispatchVisualContent } from "./_utils/dispatch-visual-content";
import { type LessonActivity } from "./get-lesson-activities-step";

/**
 * Explanation activities reuse the shared visual-description task before this
 * step runs. This workflow step turns those chosen briefs into real visual
 * payloads and keeps the per-entity streaming and retry behavior around the
 * expensive visual generation work.
 */
export async function generateExplanationVisualContentStep(
  activity: LessonActivity,
  descriptions: VisualDescription[],
): Promise<{ visuals: Record<string, unknown>[] }> {
  "use step";

  await using stream = createEntityStepStream<ActivityStepName>(activity.id);
  await stream.status({ status: "started", step: "generateVisualContent" });

  if (descriptions.length === 0) {
    await stream.status({ status: "completed", step: "generateVisualContent" });
    return { visuals: [] };
  }

  const visuals = await dispatchVisualContent({
    descriptions,
    language: activity.language,
    orgSlug: activity.lesson.chapter.course.organization?.slug,
  });

  await stream.status({ status: "completed", step: "generateVisualContent" });

  return { visuals };
}
