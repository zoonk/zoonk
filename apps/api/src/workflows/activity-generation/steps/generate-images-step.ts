import { createStepStream } from "@/workflows/_shared/stream-status";
import { generateVisualStepImage } from "@zoonk/core/steps/visual-image";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { rejected } from "@zoonk/utils/settled";
import { type StepVisual, type VisualRow } from "./generate-visuals-step";
import { type LessonActivity } from "./get-lesson-activities-step";

type StepVisualWithUrl = StepVisual & { url?: string };

/**
 * Generates images for visual rows that have kind "image" and a prompt.
 * Returns the visual rows with image URLs injected into the content.
 * No DB writes — the completed rows are passed to the save step.
 */
async function generateImagesForVisualRows({
  language,
  orgSlug,
  visualRows,
}: {
  language: string;
  orgSlug?: string;
  visualRows: VisualRow[];
}): Promise<{ completedRows: VisualRow[]; hadFailure: boolean }> {
  const imageRowIndexes: number[] = [];
  const imagePromises: Promise<{ data: string | null; error: Error | null }>[] = [];

  for (let i = 0; i < visualRows.length; i += 1) {
    const row = visualRows[i];
    const content = row?.content as Record<string, unknown> | undefined;

    if (content?.kind === "image" && typeof content.prompt === "string") {
      imageRowIndexes.push(i);
      imagePromises.push(generateVisualStepImage({ language, orgSlug, prompt: content.prompt }));
    }
  }

  if (imagePromises.length === 0) {
    return { completedRows: visualRows, hadFailure: false };
  }

  const results = await Promise.allSettled(imagePromises);

  const completedRows = [...visualRows];

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

  const hadFailure = rejected(results);
  return { completedRows, hadFailure };
}

/**
 * Builds visuals-with-urls by matching the original AI visuals
 * with the completed rows that now have image URLs injected.
 */
function buildVisualsWithUrls(
  visuals: StepVisual[],
  completedRows: VisualRow[],
): StepVisualWithUrl[] {
  return visuals.map((visual) => {
    if (visual.kind !== "image") {
      return visual;
    }

    const matchingRow = completedRows.find((row) => {
      const content = row.content as Record<string, unknown>;
      return content.kind === "image" && content.prompt === visual.prompt;
    });

    if (matchingRow) {
      const url = (matchingRow.content as Record<string, unknown>).url;
      if (typeof url === "string") {
        return { ...visual, url };
      }
    }

    return visual;
  });
}

/**
 * Generates images for visual steps of an explanation activity.
 * Receives visual data directly (no DB reads needed).
 * Returns the visual rows with image URLs injected and the visuals with URLs.
 * No DB writes — the save step handles persistence.
 */
export async function generateImagesForActivityStep(
  activity: LessonActivity,
  visuals: StepVisual[],
  visualRows: VisualRow[],
): Promise<{ completedRows: VisualRow[]; visuals: StepVisualWithUrl[] }> {
  "use step";

  await using stream = createStepStream<ActivityStepName>();

  if (visuals.length === 0 || visualRows.length === 0) {
    await stream.status({ status: "started", step: "generateImages" });
    await stream.status({ status: "completed", step: "generateImages" });
    return { completedRows: visualRows, visuals: [] };
  }

  await stream.status({ status: "started", step: "generateImages" });

  const { completedRows, hadFailure } = await generateImagesForVisualRows({
    language: activity.language,
    orgSlug: activity.lesson.chapter.course.organization?.slug,
    visualRows,
  });

  if (hadFailure) {
    await stream.status({ status: "error", step: "generateImages" });
  }

  await stream.status({ status: "completed", step: "generateImages" });

  return { completedRows, visuals: buildVisualsWithUrls(visuals, completedRows) };
}
