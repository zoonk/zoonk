import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { followUpSchema } from "../../follow-ups/follow-up-contract";
import { findOwnedGoal } from "../../learner/_utils/owned-goal";
import { mockPaperKey, readMockSupplyRequest } from "./_utils/mock-supply-request";

export type MockPaperWriting =
  | { goalId: string; owed: boolean; paper: string | null; status: "ready" }
  | { status: "notFound" | "unauthorized" };

async function readScheduledPaper({ goalId, planItemId }: { goalId: string; planItemId: string }) {
  const item = isUuid(planItemId)
    ? await prisma.planItem.findFirst({
        select: { scheduledFor: true },
        where: { id: planItemId, kind: "mock", plan: { goalId } },
      })
    : null;

  return item ? (item.scheduledFor?.toISOString() ?? null) : undefined;
}

async function isPaperOwed({
  goalId,
  paper,
  userId,
}: {
  goalId: string;
  paper: string;
  userId: string;
}): Promise<boolean> {
  const ask = await prisma.followUp.findFirst({
    select: { input: true, kind: true },
    where: { failedAt: null, key: goalId, kind: "prepareMockSupply", userId },
  });

  const owed = followUpSchema.safeParse(ask).data;
  return owed?.kind === "prepareMockSupply" && owed.input.paper === paper;
}

/**
 * The paper a learner waits for: a scheduled mock's (`planItemId`) or the anytime mock they last
 * asked for. `owed` while the ask that writes it hasn't ended, so its run is starting or writing.
 * Uncached: a wait polls it until that run takes the paper.
 */
export async function getMockPaperWriting({
  goalId,
  planItemId,
}: {
  goalId: string;
  planItemId?: string;
}): Promise<MockPaperWriting> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  const { goal, userId } = owned;
  const { shape } = readMockSupplyRequest(goal.requestedMock);

  const paper = planItemId
    ? await readScheduledPaper({ goalId, planItemId })
    : shape && mockPaperKey(shape);

  if (paper === undefined) {
    return { status: "notFound" };
  }

  return {
    goalId,
    owed: paper ? await isPaperOwed({ goalId, paper, userId }) : false,
    paper,
    status: "ready",
  };
}
