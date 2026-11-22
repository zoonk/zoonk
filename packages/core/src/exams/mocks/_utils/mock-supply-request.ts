import { DbNull, type Goal, type TransactionClient } from "@zoonk/db";
import { z } from "zod";
import { type MockShape, mockShapeSchema } from "../mock-contract";

// A paper stays covered from its first Start through a short recount. The daily run can try it again.
const requestSchema = z.object({ papers: z.array(z.string()), shape: mockShapeSchema.nullable() });

export function readMockSupplyRequest(value: Goal["requestedMock"]) {
  return requestSchema.safeParse(value).data ?? { papers: [], shape: null };
}

export function mockPaperKey(paper: MockShape | string) {
  return typeof paper === "string" ? paper : JSON.stringify([paper.kind, paper.day, paper.area]);
}

export function storedMockRequest(shape: MockShape | null, papers: string[]) {
  return shape || papers.length > 0 ? { papers, shape } : DbNull;
}

export async function recordMockPaperRequest({
  tx,
  goal,
  paper,
}: {
  tx: TransactionClient;
  goal: Pick<Goal, "id" | "requestedMock">;
  paper: MockShape | string;
}) {
  const saved = readMockSupplyRequest(goal.requestedMock);
  const key = mockPaperKey(paper);
  const shape = typeof paper === "string" ? null : paper;
  const covered = saved.papers.includes(key);
  const selected = shape ?? saved.shape;

  if (!covered || (shape && (!saved.shape || mockPaperKey(saved.shape) !== key))) {
    await tx.goal.update({
      data: {
        requestedMock: storedMockRequest(selected, covered ? saved.papers : [...saved.papers, key]),
      },
      where: { id: goal.id },
    });
  }

  return !covered;
}

export async function clearStartedPaperRequest({
  tx,
  goal,
  paper,
}: {
  tx: TransactionClient;
  goal: Pick<Goal, "id" | "requestedMock">;
  paper: MockShape | string;
}) {
  const saved = readMockSupplyRequest(goal.requestedMock);
  const key = mockPaperKey(paper);
  const shape = typeof paper === "string" ? saved.shape : null;
  const papers = saved.papers.filter((asked) => asked !== key);

  if (saved.shape !== shape || saved.papers.length !== papers.length) {
    await tx.goal.update({
      data: { requestedMock: storedMockRequest(shape, papers) },
      where: { id: goal.id },
    });
  }
}
