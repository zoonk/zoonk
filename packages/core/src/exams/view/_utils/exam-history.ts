import "server-only";
import { prisma } from "@zoonk/db";
import { getMockMeasure } from "../../mocks/mock-analysis";
import { type MockResult, mockResultSchema } from "../../mocks/mock-contract";
import { sumCalibration } from "../../scoring/net-score";
import { type ExamMockSummary } from "../exam-view-contract";

/** The history shows the latest mocks; calibration adds up every one of them. */
const HISTORY_SIZE = 10;

/**
 * The goal's finished mocks, newest first, in the exam's own terms, and Cebraspe calibration
 * added up across all of them: how often the learner is right when sure and when not.
 */
export async function loadExamHistory(
  goalId: string,
): Promise<{
  calibration: MockResult["calibration"];
  mocks: ExamMockSummary[];
  sessionsDone: number;
}> {
  const [rows, sessionsDone] = await Promise.all([
    // In creation order, so each mock keeps the number its screen showed (see `countFinishedMocksBefore`).
    prisma.mockExam.findMany({
      orderBy: { createdAt: "asc" },
      select: { blockId: true, finishedAt: true, result: true },
      where: { goalId, status: "finished" },
    }),
    prisma.studySession.count({ where: { goalId, startedAt: { not: null } } }),
  ]);

  const finished = rows.flatMap((row, index) => {
    const result = mockResultSchema.safeParse(row.result).data;
    return result && row.finishedAt ? [{ ...row, finishedAt: row.finishedAt, index, result }] : [];
  });

  const mocks = finished
    .map((row) => ({
      blockId: row.blockId,
      correct: row.result.correct,
      finishedAt: row.finishedAt.toISOString(),
      measure: getMockMeasure(row.result),
      number: row.index + 1,
      scoring: row.result.scoring,
      total: row.result.total,
    }))
    .toReversed()
    .slice(0, HISTORY_SIZE);

  const calibrations = finished.flatMap((row) =>
    row.result.calibration ? [row.result.calibration] : [],
  );

  const summed = calibrations.length > 0 ? sumCalibration(calibrations) : null;

  return {
    calibration: summed
      ? { ...summed, blankingGain: calibrations.reduce((sum, item) => sum + item.blankingGain, 0) }
      : null,
    mocks,
    sessionsDone,
  };
}
