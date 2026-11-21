import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { type MockConditions } from "../mock-contract";
import { type MockCandidate } from "../mock-plan";
import { hasStoredTimeRunOutAway } from "./owned-mock";

async function listExpiredMocks(client: TransactionClient, userId: string, instant = new Date()) {
  const sittings = await client.mockExam.findMany({
    select: {
      answers: { select: { answer: true } },
      conditions: true,
      id: true,
      sectionIndex: true,
      sectionStartedAt: true,
      status: true,
    },
    where: { itemUses: { some: {} }, status: "active", userId },
  });

  return sittings
    .filter((mock) => hasStoredTimeRunOutAway({ mock, now: instant.getTime() }))
    .map((mock) => mock.id);
}

export async function unavailableMockUse(
  client: TransactionClient,
  userId: string,
  reuse: boolean,
  now?: Date,
) {
  const expired = await listExpiredMocks(client, userId, now);

  return {
    userId,
    ...(reuse
      ? { mockExam: { status: "active" as const }, mockExamId: { notIn: expired } }
      : { OR: [{ spentAt: { not: null } }, { mockExamId: { notIn: expired } }] }),
  };
}

function sectionItemIds(section: MockConditions["sections"][number]) {
  return section.routing ? [...section.routing.easier, ...section.routing.harder] : section.itemIds;
}

export async function releaseExpiredMockItems(tx: TransactionClient, userId: string) {
  const expired = await listExpiredMocks(tx, userId);

  if (expired.length > 0) {
    await tx.mockItemUse.deleteMany({
      where: { mockExamId: { in: expired }, spentAt: null, userId },
    });
  }
}

export async function claimMockItems({
  tx,
  conditions,
  candidates = [],
  userId,
  mockExamId,
  now,
}: {
  tx: TransactionClient;
  conditions: MockConditions;
  candidates?: readonly MockCandidate[];
  userId: string;
  mockExamId: string;
  now: Date;
}) {
  const repeats = new Set(candidates.filter((item) => item.answered).map((item) => item.itemId));

  const uses = conditions.sections.flatMap((part, section) =>
    sectionItemIds(part).map((itemId) => ({
      item_id: itemId,
      section,
      spent_at: section === 0 || repeats.has(itemId) ? now : null,
    })),
  );

  await tx.$executeRaw`
    INSERT INTO mock_item_uses (user_id, mock_exam_id, item_id, section, spent_at)
    SELECT DISTINCT ON (item_id) ${userId}::uuid, ${mockExamId}::uuid, item_id, section, spent_at
    FROM jsonb_to_recordset(${JSON.stringify(uses)}::jsonb)
      AS claims(item_id uuid, section smallint, spent_at timestamp)
    ORDER BY item_id, section
    ON CONFLICT (user_id, item_id) DO UPDATE SET
      mock_exam_id = EXCLUDED.mock_exam_id,
      section = EXCLUDED.section,
      spent_at = COALESCE(EXCLUDED.spent_at, mock_item_uses.spent_at)
  `;
}

export async function spendSection({
  tx,
  mockExamId,
  section,
  conditions,
  userId,
  now,
}: {
  tx: TransactionClient;
  mockExamId: string;
  section: number;
  conditions: MockConditions;
  userId: string;
  now: Date;
}) {
  if (!conditions.sections[section]) {
    return;
  }

  await tx.mockItemUse.updateMany({
    data: { spentAt: now },
    where: { mockExamId, section, userId },
  });
}
