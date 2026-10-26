import "server-only";
import { prisma } from "@zoonk/db";
import { getString } from "@zoonk/utils/json";
import { type ProgressChange } from "../../sessions/_utils/session-progress";
import { serializeStudyBlockCompletion } from "../../sessions/completion-contract";
import { settleFinishedLesson } from "../../sessions/settle-finished-lesson";
import { type LibraryLessonCompletion } from "../contract";

/** The run's own outcome; the session block's moment is added once the run is closed. */
export type RunCompletion = Omit<LibraryLessonCompletion, "studyBlock">;

/**
 * A finished lesson checks off its plan items and, when it was one of today's session blocks,
 * completes the block and settles the day; its moment rides along so the player needs no other
 * request. Repeating a completion returns the moment again.
 */
export async function withStudyBlock({
  completion,
  energy,
  lessonId,
  runId,
  timeZone,
  userId,
}: {
  completion: RunCompletion;
  /** Energy before and after the run, when this request closed it: its moment can celebrate it. */
  energy?: ProgressChange;
  lessonId: string;
  runId: string;
  timeZone: string;
  userId: string;
}): Promise<LibraryLessonCompletion> {
  const run = await prisma.learningEvent.findUniqueOrThrow({ where: { id: runId } });
  const blockId = getString(run.contentIds, "studySessionBlockId") ?? undefined;
  const studyBlock = await settleFinishedLesson({ blockId, energy, lessonId, timeZone, userId });

  return {
    ...completion,
    studyBlock: studyBlock ? serializeStudyBlockCompletion(studyBlock) : null,
  };
}
