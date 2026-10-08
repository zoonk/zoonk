import { getWorkflowMetadata } from "workflow";
import { type ContentAnalytics } from "../_shared/content-analytics";
import {
  checkMindMapStep,
  drawMindMapStep,
  failMindMapStep,
  removeMindMapImageStep,
  writeMindMapStructureStep,
} from "./steps/chapter-mind-map-steps";

export type ChapterMindMapInput = { analytics?: ContentAnalytics; chapterId: string };

export type ChapterMindMapResult = { hasImage: boolean };

type MindMapRun = Parameters<typeof checkMindMapStep>[0];

/**
 * The text check after the map is shown: a picture with a serious mistake is drawn again with what
 * the check found and replaces it at once; when the new one fails too, the map keeps only its
 * outline. A learner who has the old picture open keeps it.
 */
async function checkShownMindMap(run: MindMapRun): Promise<ChapterMindMapResult> {
  const first = await checkMindMapStep(run);

  if (first.passed) {
    return { hasImage: first.imageUrl !== null };
  }

  await drawMindMapStep({ ...run, corrections: first.problems });
  const second = await checkMindMapStep(run);

  if (second.passed || !second.imageUrl) {
    return { hasImage: second.imageUrl !== null };
  }

  await removeMindMapImageStep({ chapterId: run.chapterId, imageUrl: second.imageUrl });
  return { hasImage: false };
}

/**
 * Makes a chapter's mind map after a learner who finished the chapter asked for it (the request
 * claimed it): its text from what the lessons teach, then its picture, shown as soon as it's drawn.
 * Its words are checked afterwards (`checkShownMindMap`), so nobody waits for the check. A run that
 * fails before the map is shown marks it failed, so the learner can ask again.
 */
export async function chapterMindMapWorkflow({
  analytics,
  chapterId,
}: ChapterMindMapInput): Promise<ChapterMindMapResult> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();

  const run = {
    analytics: {
      distinctId: analytics?.distinctId,
      goalId: analytics?.goalId,
      runId: workflowRunId,
    },
    chapterId,
  };

  try {
    await writeMindMapStructureStep(run);
    await drawMindMapStep(run);
  } catch (error) {
    await failMindMapStep({ chapterId, runId: workflowRunId });
    throw error;
  }

  return checkShownMindMap(run);
}
