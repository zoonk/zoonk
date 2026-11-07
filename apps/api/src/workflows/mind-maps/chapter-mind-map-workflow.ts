import { getWorkflowMetadata, sleep } from "workflow";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { repeatUntil } from "../_shared/repeat-until";
import { startOnce } from "../_shared/run-token";
import { getLessonContentHookToken } from "../lessons/lesson-content-result";
import { lessonContentWorkflow } from "../lessons/lesson-content-workflow";
import { type ChapterMindMapInput } from "./chapter-mind-map-input";
import {
  checkMindMapStep,
  drawMindMapStep,
  failMindMapStep,
  holdMindMapStep,
  removeMindMapImageStep,
  writeMindMapStructureStep,
} from "./steps/chapter-mind-map-steps";

export type ChapterMindMapResult = { hasImage: boolean };

type MindMapRun = Parameters<typeof checkMindMapStep>[0];

const LESSON_POLL = "10s";
const MAX_LESSON_POLLS = 240;

/** Each lesson is written by its own run, joined when one already writes it; the map waits for all. */
async function writeLessons({
  analytics,
  chapterId,
  lessons,
  runId,
}: {
  analytics?: ContentAnalytics;
  chapterId: string;
  lessons: NonNullable<ChapterMindMapInput["lessons"]>;
  runId: string;
}): Promise<void> {
  const lessonRunIds = await Promise.all(
    lessons.ids.map((lessonId) =>
      startOnce(
        lessonContentWorkflow,
        [{ analytics, forExam: lessons.forExam, lessonId, wait: "learner" }],
        getLessonContentHookToken(lessonId),
      ),
    ),
  );

  await repeatUntil({
    done: (writing) => writing === 0,
    run: () => holdMindMapStep({ chapterId, lessonRunIds, runId }),
    times: MAX_LESSON_POLLS,
    wait: () => sleep(LESSON_POLL),
  });
}

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
  lessons,
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
    if (lessons && lessons.ids.length > 0) {
      await writeLessons({ analytics, chapterId, lessons, runId: workflowRunId });
    }

    await writeMindMapStructureStep(run);
    await drawMindMapStep(run);
  } catch (error) {
    await failMindMapStep({ chapterId, runId: workflowRunId });
    throw error;
  }

  return checkShownMindMap(run);
}
