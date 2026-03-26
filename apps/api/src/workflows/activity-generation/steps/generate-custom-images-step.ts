import { createStepStream } from "@/workflows/_shared/stream-status";
import { generateVisualStepImage } from "@zoonk/core/steps/visual-image";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { rejected, settledValues } from "@zoonk/utils/settled";
import { type CustomVisualResult } from "./generate-custom-visuals-step";
import { type VisualRow } from "./generate-visuals-step";
import { type LessonActivity } from "./get-lesson-activities-step";

type CustomImageResult = {
  activityId: number;
  completedRows: VisualRow[];
};

/**
 * Generates images for a single custom activity's visual rows.
 * Returns the visual rows with image URLs injected into the content.
 * No DB writes — the save step handles persistence.
 */
async function generateImagesForActivity(
  activity: LessonActivity,
  visualResult: CustomVisualResult,
): Promise<CustomImageResult> {
  if (activity.generationStatus === "completed" || activity.generationStatus === "running") {
    return { activityId: activity.id, completedRows: visualResult.visualRows };
  }

  const orgSlug = activity.lesson.chapter.course.organization?.slug;
  const completedRows = [...visualResult.visualRows];

  const imageRowIndexes: number[] = [];
  const imagePromises: Promise<{ data: string | null; error: Error | null }>[] = [];

  for (let i = 0; i < completedRows.length; i += 1) {
    const row = completedRows[i];
    const content = row?.content as Record<string, unknown> | undefined;

    if (content?.kind === "image" && typeof content.prompt === "string") {
      imageRowIndexes.push(i);
      imagePromises.push(
        generateVisualStepImage({ language: activity.language, orgSlug, prompt: content.prompt }),
      );
    }
  }

  if (imagePromises.length === 0) {
    return { activityId: activity.id, completedRows };
  }

  const results = await Promise.allSettled(imagePromises);

  for (let j = 0; j < imageRowIndexes.length; j += 1) {
    const rowIndex = imageRowIndexes[j];
    const result = results[j];

    if (
      rowIndex !== undefined &&
      result?.status === "fulfilled" &&
      !result.value.error &&
      result.value.data
    ) {
      const originalRow = completedRows[rowIndex];

      if (originalRow) {
        completedRows[rowIndex] = {
          ...originalRow,
          content: { ...originalRow.content, url: result.value.data },
        };
      }
    }
  }

  return { activityId: activity.id, completedRows };
}

/**
 * Generates images for all custom activities' visual rows in parallel.
 * Receives visual data directly from the visuals step (no DB reads).
 * Returns completed rows with image URLs injected.
 * No DB writes — the save step handles persistence.
 */
export async function generateCustomImagesStep(
  activities: LessonActivity[],
  customVisualResults: CustomVisualResult[],
): Promise<CustomImageResult[]> {
  "use step";

  if (customVisualResults.length === 0) {
    return [];
  }

  await using stream = createStepStream<ActivityStepName>();

  await stream.status({ status: "started", step: "generateImages" });

  const allSettled = await Promise.allSettled(
    customVisualResults.map((visualResult) => {
      const activity = activities.find((act) => act.id === visualResult.activityId);
      if (!activity) {
        return Promise.resolve({
          activityId: visualResult.activityId,
          completedRows: visualResult.visualRows,
        });
      }
      return generateImagesForActivity(activity, visualResult);
    }),
  );

  const status = rejected(allSettled) ? "error" : "completed";
  await stream.status({ status, step: "generateImages" });

  return settledValues(allSettled);
}
