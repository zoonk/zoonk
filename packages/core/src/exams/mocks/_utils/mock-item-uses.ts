import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { type MockConditions, mockConditionsSchema } from "../mock-contract";
import { type MockCandidate } from "../mock-plan";
import { hasStoredTimeRunOutAway } from "./owned-mock";

export async function listMockItemClaims(
  client: TransactionClient,
  userId: string,
  mockIds?: readonly string[],
) {
  const sittings = await client.mockExam.findMany({
    select: {
      answers: { select: { answer: true } },
      conditions: true,
      id: true,
      sectionIndex: true,
      sectionStartedAt: true,
      status: true,
    },
    where: {
      status: "active",
      userId,
      ...(mockIds ? { id: { in: [...mockIds] } } : { itemUses: { some: {} } }),
    },
  });

  const now = Date.now();
  const expired = new Set<string>();
  const held = new Set<string>();
  const readable = new Map<string, { section: number; since: Date }>();

  for (const mock of sittings) {
    if (mock.sectionStartedAt.getTime() <= now) {
      readable.set(mock.id, { section: mock.sectionIndex, since: mock.sectionStartedAt });
    }

    if (hasStoredTimeRunOutAway({ mock, now })) {
      expired.add(mock.id);
    } else {
      const conditions = mockConditionsSchema.safeParse(mock.conditions).data;
      const next = mock.sectionIndex + (mock.sectionStartedAt.getTime() <= now ? 1 : 0);

      for (const section of conditions?.sections.slice(next) ?? []) {
        for (const id of sectionItemIds(section)) {
          held.add(id);
        }
      }
    }
  }

  return { expired, held, readable };
}

function sectionItemIds(section: MockConditions["sections"][number]) {
  return section.routing ? [...section.routing.easier, ...section.routing.harder] : section.itemIds;
}

export async function releaseExpiredMockItems(tx: TransactionClient, userId: string) {
  const { expired } = await listMockItemClaims(tx, userId);

  if (expired.size > 0) {
    await tx.mockItemUse.deleteMany({
      where: { mockExamId: { in: [...expired] }, spentAt: null, userId },
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
  const lastRead = new Map(
    candidates.flatMap(({ itemId, lastMockUse }) =>
      lastMockUse === undefined ? [] : [[itemId, new Date(lastMockUse)] as const],
    ),
  );

  const uses = conditions.sections.flatMap((part, section) =>
    sectionItemIds(part).map((itemId) => ({
      item_id: itemId,
      section,
      spent_at: section === 0 ? now : (lastRead.get(itemId) ?? null),
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
  // During a break, a repeat keeps its past readable date until the next section actually opens.
  await tx.mockItemUse.updateMany({
    data: { spentAt: now },
    where: { mockExamId, section, userId, ...(now.getTime() > Date.now() && { spentAt: null }) },
  });
}
