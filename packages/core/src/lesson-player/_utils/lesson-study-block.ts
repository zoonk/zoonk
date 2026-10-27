import "server-only";
import { prisma } from "@zoonk/db";
import { getString } from "@zoonk/utils/json";
import { celebrateProgress } from "../../milestones/celebrate-progress";
import { type ProgressChange } from "../../sessions/_utils/session-progress";
import { serializeStudyBlockCompletion } from "../../sessions/completion-contract";
import { NOTHING_REACHED } from "../../sessions/reached";
import { settleFinishedLesson } from "../../sessions/settle-finished-lesson";
import { type LibraryLessonCompletion } from "../contract";

/** The run's own outcome; what it reached and the session block's moment are added once it's closed. */
export type RunCompletion = Omit<LibraryLessonCompletion, "ceremony" | "reached" | "studyBlock">;

/** The Brain Power and Energy before and after a run, when this request closed it. */
export type LessonProgress = { brainPower: ProgressChange; energy: ProgressChange };

/**
 * A finished lesson checks off its plan items and, when it was one of today's session blocks,
 * completes the block and settles the day; its moment rides along so the player needs no other
 * request, and celebrates what the lesson reached. A lesson played on its own celebrates it on its
 * completion instead (the level, the tenth of Energy, the milestone not shown yet). Repeating a
 * completion returns the moment again.
 */
export async function withStudyBlock({
  completion,
  lessonId,
  progress,
  runId,
  timeZone,
  userId,
}: {
  completion: RunCompletion;
  lessonId: string;
  /** What the run added, when this request closed it: its moment can celebrate it. */
  progress?: LessonProgress;
  runId: string;
  timeZone: string;
  userId: string;
}): Promise<LibraryLessonCompletion> {
  const run = await prisma.learningEvent.findUniqueOrThrow({ where: { id: runId } });
  const blockId = getString(run.contentIds, "studySessionBlockId") ?? undefined;

  const studyBlock = await settleFinishedLesson({
    blockId,
    energy: progress?.energy,
    lessonId,
    timeZone,
    userId,
  });

  if (studyBlock) {
    return {
      ...completion,
      ceremony: null,
      reached: NOTHING_REACHED,
      studyBlock: serializeStudyBlockCompletion(studyBlock),
    };
  }

  const celebration = await celebrateProgress({ progress: progress ?? null, userId });
  return { ...completion, ...celebration, studyBlock: null };
}
