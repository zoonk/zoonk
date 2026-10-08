import {
  type MindMapAnalytics,
  type MindMapImageCheck,
  checkChapterMindMapImage,
  drawChapterMindMap,
  failChapterMindMap,
  removeChapterMindMapImage,
  showChapterMindMap,
  writeChapterMindMapStructure,
} from "@zoonk/core/mind-maps/generation";
import { safeAsync } from "@zoonk/utils/error";
import { FatalError } from "workflow";
import { withAiRetry } from "../../_shared/ai-retry";

/** Writes the map's text; a retry keeps text a failed attempt already saved. */
export async function writeMindMapStructureStep(input: {
  analytics: MindMapAnalytics;
  chapterId: string;
}): Promise<void> {
  "use step";

  await withAiRetry(() => writeChapterMindMapStructure(input));
}

/**
 * Draws the picture and shows the map, apart from the text, so a failed drawing never rewrites it;
 * with the check's corrections it draws the picture again and replaces it. The picture is paid for
 * once it's drawn: when storing it fails (Blob retries on its own first), the step doesn't run
 * again to draw another, and the run fails so the learner can ask again.
 */
export async function drawMindMapStep(input: {
  analytics: MindMapAnalytics;
  chapterId: string;
  corrections?: string[];
}): Promise<void> {
  "use step";

  const drawn = await withAiRetry(() => drawChapterMindMap(input));

  const { error } = await safeAsync(() =>
    showChapterMindMap({ chapterId: input.chapterId, drawn }),
  );

  if (error) {
    throw new FatalError(
      `Chapter ${input.chapterId}'s mind map couldn't be stored: ${error.message}`,
    );
  }
}

/** Reads the shown picture's words back and compares them with the map's, after it's shown. */
export async function checkMindMapStep(input: {
  analytics: MindMapAnalytics;
  chapterId: string;
}): Promise<MindMapImageCheck> {
  "use step";

  return withAiRetry(() => checkChapterMindMapImage(input));
}

export async function removeMindMapImageStep(input: {
  chapterId: string;
  imageUrl: string;
}): Promise<void> {
  "use step";

  await removeChapterMindMapImage(input);
}

export async function failMindMapStep(input: { chapterId: string; runId: string }): Promise<void> {
  "use step";

  await failChapterMindMap(input);
}
