import { type TransactionClient } from "@zoonk/db";
import { PlanConflictError } from "../../plans/plan-conflict";
import { oweStartedDaySettlements } from "../../sessions/_utils/owe-started-day-settlements";

type MockOccurrence = { goalId: string; planItemId: string };

function mockBlocksFor({ goalId, planItemId }: MockOccurrence) {
  return {
    kind: "checkpoint" as const,
    payload: { equals: planItemId, path: ["planItemId"] },
    session: { goalId },
  };
}

export function findMockProgress({
  client,
  ...occurrence
}: MockOccurrence & { client: TransactionClient }) {
  return client.studySessionBlock.findFirst({
    select: { id: true },
    where: {
      ...mockBlocksFor(occurrence),
      OR: [{ status: { not: "pending" } }, { mockExam: { isNot: null } }],
    },
  });
}

/** Called under the learner lock so a concurrent mock start wins or observes the removal. */
export async function removeUnstartedMockBlocks({
  tx,
  today,
  ...occurrence
}: MockOccurrence & { today: Date; tx: TransactionClient }) {
  const blocks = await tx.studySessionBlock.findMany({
    select: {
      id: true,
      mockExam: { select: { id: true } },
      session: { select: { localDate: true } },
      sessionId: true,
      status: true,
    },
    where: mockBlocksFor(occurrence),
  });

  if (blocks.some((block) => block.status !== "pending" || block.mockExam !== null)) {
    throw new PlanConflictError();
  }

  const todayBlocks = blocks.filter(
    (block) => block.session.localDate.getTime() === today.getTime(),
  );

  await tx.studySessionBlock.deleteMany({
    where: { id: { in: todayBlocks.map((block) => block.id) }, status: "pending" },
  });

  await oweStartedDaySettlements(tx, todayBlocks);
}
