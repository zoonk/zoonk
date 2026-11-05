import "server-only";
import { prisma } from "@zoonk/db";
import { type ProgressChange } from "./_utils/session-progress";
import { STUDY_SESSION_INCLUDE } from "./_utils/study-session-access";
import { type StudyBlockCompletion } from "./completion-contract";
import { finishLessonBlock } from "./finish-study-block";

/** Internal authenticated caller, for the block the lesson's completion finished in its own transaction; settles that block's day and returns its moment. */
export async function settleFinishedLesson({
  blockId,
  energy,
  timeZone,
  userId,
}: {
  blockId: string;
  /** Energy before and after the lesson, when its completion just added it (not on a replay). */
  energy?: ProgressChange | null;
  timeZone: string;
  userId: string;
}): Promise<StudyBlockCompletion | null> {
  const found = await prisma.studySessionBlock.findFirst({
    include: { session: { include: STUDY_SESSION_INCLUDE } },
    where: { id: blockId, session: { userId } },
  });

  if (!found) {
    return null;
  }

  const { session, ...block } = found;
  const result = await finishLessonBlock({ block, energy, session, timeZone, userId });

  return result.status === "ready" ? result.completion : null;
}
