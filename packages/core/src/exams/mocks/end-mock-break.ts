import "server-only";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { spendSection } from "./_utils/mock-item-uses";
import { findOwnedMock } from "./_utils/owned-mock";

export type EndMockBreakResult = { status: "notFound" | "notOnBreak" | "started" | "unauthorized" };

export async function endMockBreak({ blockId }: { blockId: string }): Promise<EndMockBreakResult> {
  const found = await findOwnedMock(blockId);

  if (found.status !== "ready") {
    return found;
  }

  const { mock } = found.owned;
  const now = new Date();

  if (mock?.status !== "active" || mock.sectionStartedAt.getTime() <= now.getTime()) {
    return { status: "notOnBreak" };
  }

  const count = await writeLearnerChange({ userId: found.owned.userId }, async (tx) => {
    const updated = await tx.mockExam.updateMany({
      data: { sectionStartedAt: now },
      where: {
        id: mock.id,
        sectionIndex: mock.sectionIndex,
        sectionStartedAt: { equals: mock.sectionStartedAt, gt: now },
        status: "active",
      },
    });

    if (updated.count)
      await spendSection({
        tx,
        mockExamId: mock.id,
        section: mock.sectionIndex,
        conditions: mock.conditions,
        userId: mock.userId,
        now,
      });
    return updated.count > 0 ? updated.count : unchanged(updated.count);
  });

  return { status: count === 0 ? "notOnBreak" : "started" };
}
