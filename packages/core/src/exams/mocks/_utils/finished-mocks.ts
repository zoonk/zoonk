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

/** What the exam's history reads of a finished mock. */
export const FINISHED_MOCK_SELECT = {
  blockId: true,
  conditions: true,
  finishedAt: true,
  id: true,
  result: true,
} as const;

type FinishedMockRow = Pick<MockExam, keyof typeof FINISHED_MOCK_SELECT>;

/** A finished mock with its result read, numbered as its screen showed it. */
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

/**
 * A finished mock's row read, with its number ("Mock exam 3" is the one after two finished ones,
 * see `countFinishedMocksBefore`). Null when its result can't be read.
 */
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

/**
 * The id a finished mock's result opens by: its session block's for a scheduled one (null once
 * its session is gone), its own for one taken any time.
 */
function getOpenId({ blockId, id, purpose }: Pick<FinishedMock, "blockId" | "id" | "purpose">) {
  if (blockId) {
    return blockId;
  }

  return purpose === "planned" ? null : id;
}

/** A finished mock as the exam's history lists it, in the exam's own terms. */
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

/**
 * The goal's latest mock, as the exam's history lists it first (the last one created of those
 * finished, so it has the highest number); null before the first.
 */
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
