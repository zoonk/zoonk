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
