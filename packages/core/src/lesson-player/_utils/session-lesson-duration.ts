import "server-only";
import { type LearningEvent, type TransactionClient } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { getCappedLessonDurationSeconds } from "../../player/contracts/completion-duration";
import { getBlockElapsedMs, pausedBlockTiming } from "../../sessions/_utils/block-timing";
import { findDayLessonBlock } from "../../sessions/_utils/day-lesson-block";
import { readBlockPayload } from "../../sessions/block-payload";

/** Called under the learner's progress lock; a session lesson shares its block's focused clock. */
export async function getLessonCompletionSeconds({
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
}): Promise<number> {
  const found = await findDayLessonBlock({ client: tx, lessonId, now, timeZone, userId });

  if (found) {
    await tx.$queryRaw`SELECT id FROM study_session_blocks WHERE id = ${found.id}::uuid FOR UPDATE`;
  }

  const block = found ? await tx.studySessionBlock.findUnique({ where: { id: found.id } }) : null;
  /** An earlier sitting closed after its block was paid cannot charge the same study again. */
  if (
    block?.completedAt &&
    run.startedAt <= block.completedAt &&
    readBlockPayload(block).timing?.recordedMs !== undefined
  ) {
    return 0;
  }

  const timing = block?.status === "active" ? readBlockPayload(block).timing : null;

  if (!block || !timing) {
    return getCappedLessonDurationSeconds({
      now: now.getTime(),
      startedAt: run.startedAt.getTime(),
    });
  }

  const elapsedMs = getBlockElapsedMs({ block, now });

  await tx.studySessionBlock.update({
    data: {
      payload: {
        ...readBlockPayload(block),
        timing: { ...pausedBlockTiming({ block, now }), recordedMs: elapsedMs },
      },
    },
    where: { id: block.id },
  });

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

  const elapsedSeconds = getCappedLessonDurationSeconds({
    now: now.getTime(),
    startedAt: now.getTime() - elapsedMs,
  });

  const recordedSeconds = getCappedLessonDurationSeconds({
    now: now.getTime(),
    startedAt: now.getTime() - (timing.recordedMs ?? 0),
  });

  return Math.max(0, elapsedSeconds - recordedSeconds);
}
