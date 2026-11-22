import "server-only";
import { type Goal, type TransactionClient, prisma } from "@zoonk/db";
import { type ExamStructure } from "../../../library/exams/blueprint-contract";
import { findWritingPrompts } from "../../essays/writing-supply";
import { type MockShape } from "../mock-contract";
import { listMockWrittenRequests } from "../written-parts";

export async function findMockWriting({
  goal,
  goalId,
  shape,
  structure,
  tx = prisma,
  userId,
}: {
  goal?: Goal;
  goalId: string;
  shape: Pick<MockShape, "day" | "kind">;
  structure: ExamStructure | null;
  tx?: TransactionClient;
  userId: string;
}) {
  const requests = listMockWrittenRequests({ shape, structure });

  if (requests.length === 0) {
    return { essays: [], status: "ready" as const };
  }

  const found = await findWritingPrompts({ goal, goalId, requests, tx, userId });

  if (found.status === "missing") {
    return {
      requests: requests.filter((request) =>
        found.requests.some((missing) => missing.taskKey === request.taskKey),
      ),
      status: "missing" as const,
    };
  }

  const keys = requests.flatMap(({ count, taskKey }) =>
    Array.from({ length: count }, () => taskKey),
  );

  if (new Set(found.itemIds).size !== keys.length || found.itemIds.length !== keys.length) {
    throw new Error("The writing bank did not return one distinct prompt per mock task.");
  }

  let offset = 0;

  const essays = requests.flatMap(({ count, taskKey }) => {
    const items = found.itemIds.slice(offset, offset + count);
    offset += count;
    return items.map((itemId) => ({ itemId, taskKey }));
  });

  return { essays, status: "ready" as const };
}
