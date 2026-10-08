import "server-only";
import { prisma } from "@zoonk/db";
import { getMockMeasure } from "../../mocks/mock-analysis";
import {
  type MockPurpose,
  type MockResult,
  mockConditionsSchema,
  mockResultSchema,
} from "../../mocks/mock-contract";
import { sumCalibration } from "../../scoring/net-score";
import { type ExamMockSummary } from "../exam-view-contract";
import { loadExamWork } from "./exam-work";

/**
 * The id a finished mock's result opens by: its session block's for a scheduled one (null once
 * its session is gone), its own for one taken any time.
 */
function getOpenId({
  blockId,
  id,
  purpose,
}: {
  blockId: string | null;
  id: string;
  purpose: MockPurpose;
}) {
  if (blockId) {
    return blockId;
  }

  return purpose === "planned" ? null : id;
}

/** The history shows the latest mocks; calibration adds up every one of them. */
const HISTORY_SIZE = 10;

/**
 * The goal's finished mocks, newest first, in the exam's own terms, Cebraspe calibration added up
 * across all of them (how often the learner is right when sure and when not), and the work behind
 * them (see `loadExamWork`).
 */
export async function loadExamHistory({
  goalId,
  today,
}: {
  goalId: string;
  /** The learner-local date, as a UTC-midnight label. */
  today: Date;
}): Promise<{
  calibration: MockResult["calibration"];
  mocks: ExamMockSummary[];
  prepared: boolean;
  sessionsDone: number;
}> {
  const [rows, work] = await Promise.all([
    // In creation order, so each mock keeps the number its screen showed (see `countFinishedMocksBefore`).
    prisma.mockExam.findMany({
      orderBy: { createdAt: "asc" },
      select: { blockId: true, conditions: true, finishedAt: true, id: true, result: true },
      where: { goalId, status: "finished" },
    }),
    loadExamWork({ goalId, today }),
  ]);

  const finished = rows.flatMap((row, index) => {
    const result = mockResultSchema.safeParse(row.result).data;
    const conditions = mockConditionsSchema.safeParse(row.conditions).data;
    const purpose = conditions?.purpose ?? "planned";
    const shape = conditions?.shape ?? null;

    return result && row.finishedAt
      ? [{ ...row, finishedAt: row.finishedAt, index, purpose, result, shape }]
      : [];
  });

  const mocks = finished
    .map((row) => ({
      blockId: getOpenId({ blockId: row.blockId, id: row.id, purpose: row.purpose }),
      correct: row.result.correct,
      finishedAt: row.finishedAt.toISOString(),
      measure: getMockMeasure(row.result),
      number: row.index + 1,
      purpose: row.purpose,
      scoring: row.result.scoring,
      shape: row.shape,
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
    ...work,
  };
}
