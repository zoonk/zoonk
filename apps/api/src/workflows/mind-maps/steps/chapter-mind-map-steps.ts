import {
  type MindMapAnalytics,
  type MindMapImageCheck,
  checkChapterMindMapImage,
  drawChapterMindMap,
  failChapterMindMap,
  holdChapterMindMap,
  removeChapterMindMapImage,
  showChapterMindMap,
  writeChapterMindMapStructure,
} from "@zoonk/core/mind-maps/generation";
import { safeAsync } from "@zoonk/utils/error";
import { FatalError } from "workflow";
import { isRunActive } from "../../_shared/run-activity";

/** Keeps the map on its way while its lessons are written, and says how many still are. */
export async function holdMindMapStep({
  chapterId,
  lessonRunIds,
  runId,
}: {
  chapterId: string;
  lessonRunIds: string[];
  runId: string;
}): Promise<number> {
  "use step";

  await holdChapterMindMap({ chapterId, runId });

  const active = await Promise.all(lessonRunIds.map((lessonRunId) => isRunActive(lessonRunId)));
  return active.filter(Boolean).length;
}

export async function writeMindMapStructureStep(input: {
  analytics: MindMapAnalytics;
  chapterId: string;
}): Promise<void> {
  "use step";

  await writeChapterMindMapStructure(input);
}

/** A drawn picture is paid for, so a failed store fails the run instead of retrying to draw another. */
export async function drawMindMapStep(input: {
  analytics: MindMapAnalytics;
  chapterId: string;
  corrections?: string[];
}): Promise<void> {
  "use step";

  const drawn = await drawChapterMindMap(input);

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

  return checkChapterMindMapImage(input);
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
