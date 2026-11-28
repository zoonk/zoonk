import "server-only";
import { prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getLearnerModelCacheTag } from "../../cache/tags";
import { mockWrittenPartsSchema } from "../../exams/mocks/mock-points-contract";

export async function readLatestWrittenMocks({
  goalId,
  userId,
}: {
  goalId: string;
  userId: string;
}) {
  "use cache: private";

  cacheTag(getLearnerModelCacheTag(userId));

  const rows = await prisma.$queryRaw<{ id: string; part: unknown }[]>`
    SELECT latest.id, latest.part
    FROM (
      SELECT DISTINCT ON (part->>'name') mock.id, part, mock.finished_at
      FROM mock_exams mock
      CROSS JOIN LATERAL jsonb_array_elements(mock.conditions->'writtenParts') part
      WHERE mock.goal_id = ${goalId}::uuid AND mock.user_id = ${userId}::uuid
        AND mock.status = 'finished' AND mock.finished_at IS NOT NULL
        AND jsonb_typeof(mock.conditions->'writtenParts') = 'array'
      ORDER BY part->>'name', mock.finished_at DESC, mock.id DESC
    ) latest
    ORDER BY latest.finished_at DESC, latest.id DESC
  `;

  return rows.flatMap(({ id, part }) => {
    const parsed = mockWrittenPartsSchema.element.safeParse(part).data;
    return parsed ? [{ id, part: parsed }] : [];
  });
}
