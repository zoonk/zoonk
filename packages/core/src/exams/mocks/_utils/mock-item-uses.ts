import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { type MockConditions } from "../mock-contract";
import { hasStoredTimeRunOutAway } from "./owned-mock";

export async function releaseExpiredMockItems(tx: TransactionClient, userId: string) {
  const sittings = await tx.mockExam.findMany({
    include: { answers: { select: { answer: true } } },
    where: { userId, status: "active", itemUses: { some: { spentAt: null } } },
  });
  const now = Date.now();
  const expired = sittings.filter((mock) => hasStoredTimeRunOutAway({ mock, now }));
  if (expired.length) {
    await tx.mockItemUse.deleteMany({
      where: { userId, mockExamId: { in: expired.map((mock) => mock.id) }, spentAt: null },
    });
  }
}

export async function claimMockItems({
  tx,
  conditions,
  userId,
  mockExamId,
  now,
}: {
  tx: TransactionClient;
  conditions: MockConditions;
  userId: string;
  mockExamId: string;
  now: Date;
}) {
  const uses = conditions.sections.flatMap((section, index) => {
    const ids = section.routing
      ? [...section.routing.easier, ...section.routing.harder]
      : section.itemIds;
    return ids.map((itemId) => ({
      userId,
      itemId,
      mockExamId,
      section: index,
      spentAt: index === 0 ? now : null,
    }));
  });
  if (!uses.length) return;
  await tx.mockItemUse.createMany({ data: uses, skipDuplicates: true });
  await spendSection({ tx, mockExamId, section: 0, conditions, userId, now });
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
  const part = conditions.sections[section];
  if (!part) return;
  const ids = part.routing ? [...part.routing.easier, ...part.routing.harder] : part.itemIds;
  await tx.mockItemUse.updateMany({
    where: { userId, itemId: { in: ids } },
    data: { mockExamId, section, spentAt: now },
  });
}
