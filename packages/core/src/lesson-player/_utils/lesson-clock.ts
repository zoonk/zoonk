import "server-only";
import { randomUUID } from "node:crypto";
import { type LearningEvent, type TransactionClient } from "@zoonk/db";
import { getBlockElapsedMs } from "../../sessions/_utils/block-timing";
import { readBlockPayload } from "../../sessions/block-payload";
import { getRunStudySessionId } from "./lesson-runs";

/** Caller holds the learner lock; a new player opening replaces the earlier device's interval. */
export async function startLessonClock({
  lessonId,
  run,
  tx,
  userId,
}: {
  lessonId: string;
  run: LearningEvent;
  tx: TransactionClient;
  userId: string;
}): Promise<string | null> {
  const sessionId = getRunStudySessionId(run);

  if (!sessionId || run.endedAt) {
    return null;
  }

  const blocks = await tx.studySessionBlock.findMany({
    where: { kind: "learn", lessonId, session: { userId }, sessionId, status: "active" },
  });

  const found =
    blocks.find((block) => {
      const timing = readBlockPayload(block).timing;
      return timing ? timing.activeAt !== null : block.startedAt !== null;
    }) ?? blocks.find((block) => readBlockPayload(block).timing?.clock?.runId === run.id);

  if (!found) {
    return null;
  }

  await tx.$queryRaw`SELECT id FROM study_session_blocks WHERE id = ${found.id}::uuid FOR UPDATE`;
  const block = await tx.studySessionBlock.findUniqueOrThrow({ where: { id: found.id } });
  const now = new Date();
  const id = randomUUID();

  await tx.studySessionBlock.update({
    data: {
      payload: {
        ...readBlockPayload(block),
        timing: {
          ...readBlockPayload(block).timing,
          activeAt: now.toISOString(),
          clock: { id, runId: run.id, sequence: 0 },
          elapsedMs: getBlockElapsedMs({ block, now }),
        },
      },
    },
    where: { id: block.id },
  });

  return id;
}
