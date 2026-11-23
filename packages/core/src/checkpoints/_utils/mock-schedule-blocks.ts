import { type TransactionClient } from "@zoonk/db";

type MockOccurrence = { goalId: string; planItemId: string };

export function mockBlocksFor({ goalId, planItemId }: MockOccurrence) {
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
