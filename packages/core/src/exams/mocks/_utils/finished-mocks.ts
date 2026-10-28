import "server-only";
import { type MockExam, prisma } from "@zoonk/db";
import { type ExamMockSummary } from "../../view/exam-view-contract";
import { getMockMeasure } from "../mock-analysis";
import {
  type MockPurpose,
  type MockResult,
  type MockShape,
  mockConditionsSchema,
  mockResultSchema,
} from "../mock-contract";

export const FINISHED_MOCK_SELECT = {
  blockId: true,
  conditions: true,
  finishedAt: true,
  id: true,
  result: true,
} as const;

type FinishedMockRow = Pick<MockExam, keyof typeof FINISHED_MOCK_SELECT>;

export type FinishedMock = {
  blockId: string | null;
  examQuestions: number | null;
  finishedAt: Date;
  id: string;
  number: number;
  purpose: MockPurpose;
  result: MockResult;
  reused: number;
  shape: MockShape | null;
};

export function readFinishedMock({
  number,
  row,
}: {
  number: number;
  row: FinishedMockRow;
}): FinishedMock | null {
  const result = mockResultSchema.safeParse(row.result).data;
  const conditions = mockConditionsSchema.safeParse(row.conditions).data;

  if (!result || !row.finishedAt) {
    return null;
  }

  return {
    blockId: row.blockId,
    examQuestions: conditions?.examQuestions ?? null,
    finishedAt: row.finishedAt,
    id: row.id,
    number,
    purpose: conditions?.purpose ?? "planned",
    result,
    reused: conditions?.reused ?? 0,
    shape: conditions?.shape ?? null,
  };
}

function getOpenId({ blockId, id, purpose }: Pick<FinishedMock, "blockId" | "id" | "purpose">) {
  if (blockId) {
    return blockId;
  }

  return purpose === "planned" ? null : id;
}

export function toMockSummary(mock: FinishedMock): ExamMockSummary {
  return {
    blockId: getOpenId(mock),
    correct: mock.result.correct,
    examQuestions: mock.examQuestions,
    finishedAt: mock.finishedAt.toISOString(),
    measure: getMockMeasure(mock.result),
    number: mock.number,
    purpose: mock.purpose,
    scoring: mock.result.scoring,
    shape: mock.shape,
    total: mock.result.total,
  };
}

export async function findLastMock(goalId: string): Promise<ExamMockSummary | null> {
  /** A concurrent completion must not attach its number to the previous mock's result. */
  const [row, finished] = await prisma.$transaction(
    (transaction) =>
      Promise.all([
        transaction.mockExam.findFirst({
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: FINISHED_MOCK_SELECT,
          where: { goalId, status: "finished" },
        }),
        transaction.mockExam.count({ where: { goalId, status: "finished" } }),
      ]),
    { isolationLevel: "RepeatableRead" },
  );

  const mock = row ? readFinishedMock({ number: finished, row }) : null;
  return mock ? toMockSummary(mock) : null;
}
