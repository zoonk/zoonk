import "server-only";
import { type FollowUp as FollowUpRow, prisma } from "@zoonk/db";
import { logError } from "@zoonk/utils/logger";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getGoalsCacheTag, getLearnerModelCacheTag } from "../cache/tags";
import { type OwedFollowUp, followUpSchema } from "./follow-up-contract";

const BATCH = 50;
const OLD_AFTER_MS = 900_000;
const SWEPT_LEARNERS = 1000;

/** A row whose input no longer parses can never run, so it's logged and dropped. */
async function readRow(row: FollowUpRow): Promise<OwedFollowUp | null> {
  const parsed = followUpSchema.safeParse({ input: row.input, kind: row.kind });

  if (parsed.success) {
    return { ...parsed.data, id: row.id, key: row.key, revision: row.revision, userId: row.userId };
  }

  logError(`Dropped follow-up ${row.id}, whose input no longer reads.`, parsed.error);
  await prisma.followUp.deleteMany({ where: { id: row.id } });
  return null;
}

/** Internal, for the follow-ups workflow: the learner's owed work, oldest first. Reads only. */
export async function listFollowUps(userId: string): Promise<OwedFollowUp[]> {
  const rows = await prisma.followUp.findMany({
    orderBy: { requestedAt: "asc" },
    take: BATCH,
    where: { userId },
  });

  const read = await Promise.all(rows.map((row) => readRow(row)));
  return read.filter((row) => row !== null);
}

/** Keeps the row when the same work was asked for again after it was listed. */
export async function endFollowUp({
  id,
  revision,
}: {
  id: string;
  revision: number;
}): Promise<void> {
  const ended = await prisma.$queryRaw<{ rebuilt: boolean; userId: string }[]>`
    DELETE FROM follow_ups WHERE id = ${id}::uuid AND revision = ${revision}
    RETURNING user_id AS "userId", kind = 'rebuild_goal_curriculum'::"FollowUpKind" AS rebuilt
  `;

  for (const row of ended) {
    if (row.rebuilt) {
      revalidateCacheTags([getGoalsCacheTag(row.userId), getLearnerModelCacheTag(row.userId)]);
    }
  }
}

export function countFollowUps(userId: string): Promise<number> {
  return prisma.followUp.count({ where: { userId } });
}

/** Learners whose owed work no run has taken for a while, such as after a start that failed. */
export async function listLearnersWithOldFollowUps(): Promise<string[]> {
  const rows = await prisma.followUp.groupBy({
    by: ["userId"],
    orderBy: { userId: "asc" },
    take: SWEPT_LEARNERS,
    where: { requestedAt: { lt: new Date(Date.now() - OLD_AFTER_MS) } },
  });

  return rows.map((row) => row.userId);
}
