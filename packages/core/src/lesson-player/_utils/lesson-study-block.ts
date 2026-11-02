import "server-only";
import { prisma } from "@zoonk/db";
import { getString } from "@zoonk/utils/json";
import { celebrateProgress } from "../../milestones/celebrate-progress";
import { type ProgressChange } from "../../sessions/_utils/session-progress";
import { serializeStudyBlockCompletion } from "../../sessions/completion-contract";
import { NOTHING_REACHED } from "../../sessions/reached";
import { settleFinishedLesson } from "../../sessions/settle-finished-lesson";
import { type LibraryLessonCompletion } from "../contract";

export type RunCompletion = Omit<LibraryLessonCompletion, "ceremony" | "reached" | "studyBlock">;

export type LessonProgress = { brainPower: ProgressChange; energy: ProgressChange };

/** Repeated completions return the same moment; standalone lessons celebrate on completion instead. */
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
  /** Supply only when this request closed the run. */
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
    runStartedAt: run.startedAt,
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
