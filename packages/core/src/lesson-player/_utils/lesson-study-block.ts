import "server-only";
import { type LearningEvent, type TransactionClient, prisma } from "@zoonk/db";
import { getString, isJsonObject } from "@zoonk/utils/json";
import { celebrateProgress } from "../../milestones/celebrate-progress";
import { findDayLessonBlock } from "../../sessions/_utils/day-lesson-block";
import { completeLessonBlock } from "../../sessions/_utils/lesson-block";
import { type ProgressChange } from "../../sessions/_utils/session-progress";
import { serializeStudyBlockCompletion } from "../../sessions/completion-contract";
import { NOTHING_REACHED } from "../../sessions/reached";
import { settleFinishedLesson } from "../../sessions/settle-finished-lesson";
import { type LibraryLessonCompletion } from "../contract";

export type RunCompletion = Omit<
  LibraryLessonCompletion,
  "ceremony" | "certificates" | "reached" | "studyBlock"
>;

export type LessonProgress = { brainPower: ProgressChange; energy: ProgressChange };

/** Caller must hold the learner's progress lock. */
export async function lockRunBlock({
  lessonId,
  now,
  run,
  timeZone,
  tx,
  userId,
}: {
  lessonId: string;
  now: Date;
  run: LearningEvent;
  timeZone: string;
  tx: TransactionClient;
  userId: string;
}) {
  const found = await findDayLessonBlock({
    client: tx,
    lessonId,
    now,
    runStartedAt: run.startedAt,
    timeZone,
    userId,
  });

  if (!found) {
    return null;
  }

  await tx.$queryRaw`SELECT id FROM study_session_blocks WHERE id = ${found.id}::uuid FOR UPDATE`;
  const block = await tx.studySessionBlock.findUnique({ where: { id: found.id } });

  return block && { ...block, session: found.session };
}

type RunBlock = NonNullable<Awaited<ReturnType<typeof lockRunBlock>>>;

/** Commits the block with the run that finished it, so a failed settlement still leaves it done and its day owed, and a retry on a later day still settles that day. */
export async function completeRunBlock(
  tx: TransactionClient,
  {
    block,
    brainPower,
    lessonId,
    now,
    run,
    timeZone,
    userId,
  }: {
    block: RunBlock;
    brainPower: number;
    lessonId: string;
    now: Date;
    run: LearningEvent;
    timeZone: string;
    userId: string;
  },
): Promise<boolean> {
  const done = await completeLessonBlock(tx, {
    block,
    brainPower,
    lessonId,
    now,
    timeZone,
    userId,
  });

  if (!done) {
    return false;
  }

  await tx.learningEvent.update({
    data: {
      contentIds: {
        ...(isJsonObject(run.contentIds) ? run.contentIds : {}),
        studySessionBlockId: block.id,
        studySessionId: block.sessionId,
      },
    },
    where: { id: run.id },
  });

  return true;
}

/** Repeated completions return the same moment; a run that finished no block celebrates on its own. */
export async function withStudyBlock({
  completion,
  progress,
  runId,
  timeZone,
  userId,
}: {
  completion: RunCompletion;
  /** Supply only when this request closed the run. */
  progress?: LessonProgress;
  runId: string;
  timeZone: string;
  userId: string;
}): Promise<LibraryLessonCompletion> {
  const run = await prisma.learningEvent.findUniqueOrThrow({ where: { id: runId } });
  const blockId = getString(run.contentIds, "studySessionBlockId");

  const studyBlock = blockId
    ? await settleFinishedLesson({ blockId, energy: progress?.energy, timeZone, userId })
    : null;

  if (studyBlock) {
    return {
      ...completion,
      ceremony: null,
      certificates: [],
      reached: NOTHING_REACHED,
      studyBlock: serializeStudyBlockCompletion(studyBlock),
    };
  }

  const celebration = await celebrateProgress({ progress: progress ?? null, userId });
  return { ...completion, ...celebration, studyBlock: null };
}
