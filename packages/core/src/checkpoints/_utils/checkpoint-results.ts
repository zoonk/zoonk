import "server-only";
import { prisma } from "@zoonk/db";
import { z } from "zod";
import { type CheckpointKind } from "../../sessions/brain-power";
import { getPassMark, hasPassedCheckpoint } from "../checkpoint-rules";

/**
 * Checkpoints land in the ledger as `checkpoint` rows (bosses and non-exam weekly challenges) or
 * `mock` rows (an exam's weekly Big Challenge), with the checkpoint's kind as the row's
 * `lessonKind` text, so milestones can tell a boss from a Big Challenge without reading content.
 */
export const CHECKPOINT_LEDGER_KINDS: Readonly<Record<CheckpointKind, string>> = {
  boss: "boss",
  finalBoss: "finalBoss",
  weekly: "weeklyChallenge",
};

const contentIdsSchema = z.object({
  planItemId: z.string().optional(),
  studySessionBlockId: z.string().optional(),
  studySessionId: z.string().optional(),
});

export type CheckpointResult = {
  correct: number;
  localDate: Date;
  passed: boolean;
  studySessionBlockId: string | null;
  studySessionId: string | null;
  total: number;
};

/** The learner's latest finished attempt at a plan's checkpoint, or null before the first. */
export async function findLastCheckpointResult({
  planItemId,
  userId,
}: {
  planItemId: string;
  userId: string;
}): Promise<CheckpointResult | null> {
  const event = await prisma.learningEvent.findFirst({
    orderBy: { endedAt: "desc" },
    where: {
      contentIds: { equals: planItemId, path: ["planItemId"] },
      endedAt: { not: null },
      kind: { in: ["checkpoint", "mock"] },
      userId,
    },
  });

  if (!event) {
    return null;
  }

  const ids = contentIdsSchema.safeParse(event.contentIds).data ?? {};
  const total = event.correctAnswers + event.incorrectAnswers;

  return {
    correct: event.correctAnswers,
    localDate: event.localDate,
    passed: hasPassedCheckpoint({ correct: event.correctAnswers, passMark: getPassMark(total) }),
    studySessionBlockId: ids.studySessionBlockId ?? null,
    studySessionId: ids.studySessionId ?? null,
    total,
  };
}
