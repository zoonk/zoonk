import "server-only";
import { type LearningEvent, type TransactionClient, prisma } from "@zoonk/db";
import { z } from "zod";
import { type CheckpointKind } from "../../sessions/brain-power";
import { getPassMark, hasPassedCheckpoint } from "../checkpoint-rules";

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

function toCheckpointResult(
  event: Pick<LearningEvent, "contentIds" | "correctAnswers" | "incorrectAnswers" | "localDate">,
): CheckpointResult {
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

export async function findLastCheckpointResult({
  planItemId,
  userId,
  client = prisma,
}: {
  client?: Pick<TransactionClient, "learningEvent">;
  planItemId: string;
  userId: string;
}): Promise<CheckpointResult | null> {
  const event = await client.learningEvent.findFirst({
    orderBy: { endedAt: "desc" },
    where: {
      contentIds: { equals: planItemId, path: ["planItemId"] },
      endedAt: { not: null },
      kind: { in: ["checkpoint", "mock"] },
      userId,
    },
  });

  return event ? toCheckpointResult(event) : null;
}

export async function findLastCheckpointResults({
  planItemIds,
  userId,
  client = prisma,
}: {
  planItemIds: readonly string[];
  userId: string;
  client?: Pick<TransactionClient, "$queryRaw">;
}): Promise<ReadonlyMap<string, CheckpointResult>> {
  if (planItemIds.length === 0) {
    return new Map();
  }

  const events = await client.$queryRaw<
    Pick<LearningEvent, "contentIds" | "correctAnswers" | "incorrectAnswers" | "localDate">[]
  >`
    SELECT latest.*
    FROM unnest(${[...planItemIds]}::text[]) AS requested(id)
    CROSS JOIN LATERAL (
      SELECT content_ids AS "contentIds", correct_answers AS "correctAnswers",
        incorrect_answers AS "incorrectAnswers", local_date AS "localDate"
      FROM learning_events
      WHERE user_id = ${userId}::uuid
        AND kind IN ('checkpoint', 'mock')
        AND ended_at IS NOT NULL
        AND content_ids @> jsonb_build_object('planItemId', requested.id)
      ORDER BY ended_at DESC
      LIMIT 1
    ) AS latest
  `;

  return events.reduce((results, event) => {
    const ids = contentIdsSchema.safeParse(event.contentIds).data;

    if (!ids?.planItemId || results.has(ids.planItemId)) {
      return results;
    }

    return results.set(ids.planItemId, toCheckpointResult(event));
  }, new Map<string, CheckpointResult>());
}
