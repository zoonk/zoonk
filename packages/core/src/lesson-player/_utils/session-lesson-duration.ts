import "server-only";
import { type LearningEvent, type StudySessionBlock, type TransactionClient } from "@zoonk/db";
import { getCappedLessonDurationSeconds } from "../../player/contracts/completion-duration";
import { getBlockElapsedMs, pausedBlockTiming } from "../../sessions/_utils/block-timing";
import { readBlockPayload } from "../../sessions/block-payload";

/** Pass the run's block locked in the same transaction; session lessons share the block's focused clock. */
export async function getLessonCompletionSeconds({
  block,
  now,
  run,
  tx,
}: {
  block: StudySessionBlock | null;
  now: Date;
  run: LearningEvent;
  tx: TransactionClient;
}): Promise<number> {
  /** An earlier sitting must not charge study time its block already paid. */
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
