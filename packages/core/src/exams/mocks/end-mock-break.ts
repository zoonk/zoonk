import "server-only";
import { prisma } from "@zoonk/db";
import { findOwnedMock } from "./_utils/owned-mock";

export type EndMockBreakResult = { status: "notFound" | "notOnBreak" | "started" | "unauthorized" };

/**
 * Ends the break between two sections now, like walking back into the room early: the next
 * section's clock starts. Once the break has run out, its clock started on its own.
 */
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

  const { count } = await prisma.mockExam.updateMany({
    data: { sectionStartedAt: now },
    where: {
      id: mock.id,
      sectionIndex: mock.sectionIndex,
      sectionStartedAt: { gt: now },
      status: "active",
    },
  });

  return { status: count === 0 ? "notOnBreak" : "started" };
}
