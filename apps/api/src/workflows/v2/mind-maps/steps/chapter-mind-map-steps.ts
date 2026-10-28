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

export async function writeMindMapStructureStep(input: {
  analytics: MindMapAnalytics;
  chapterId: string;
}): Promise<void> {
  "use step";

  await withAiRetry(() => writeChapterMindMapStructure(input));
}

/** A drawn picture is paid for, so a failed store fails the run instead of retrying to draw another. */
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
