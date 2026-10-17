import "server-only";
import { prisma } from "@zoonk/db";
import {
  FINISHED_MOCK_SELECT,
  readFinishedMock,
  toMockSummary,
} from "../../mocks/_utils/finished-mocks";
import { type MockResult } from "../../mocks/mock-contract";
import { sumCalibration } from "../../scoring/net-score";
import { type ExamMockProgress, type ExamMockSummary } from "../exam-view-contract";
import { loadExamCalibration } from "./exam-calibration";
import { loadExamWork } from "./exam-work";
import { MOCK_PROGRESS_SIZE, getMockProgress } from "./mock-progress";

/** The history shows the latest mocks; calibration adds up every one of them. */
const HISTORY_SIZE = 10;

/**
 * The goal's finished mocks, newest first, in the exam's own terms, Cebraspe calibration added up
 * across all of them (how often the learner is right when sure and when not), how they went over
 * time (see `getMockProgress`), and the work behind them (see `loadExamWork`).
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
  progress: ExamMockProgress | null;
  sessionsDone: number;
}> {
  const [[rows, total, calibration], work] = await Promise.all([
    /** A completion between reads must not shift numbers or add unseen calibration. */
    prisma.$transaction(
      (transaction) =>
        Promise.all([
          // The chart needs twenty snapshots; numbering still counts every finished mock.
          transaction.mockExam.findMany({
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            select: FINISHED_MOCK_SELECT,
            take: MOCK_PROGRESS_SIZE,
            where: { goalId, status: "finished" },
          }),
          transaction.mockExam.count({ where: { goalId, status: "finished" } }),
          loadExamCalibration({ goalId, transaction }),
        ]),
      { isolationLevel: "RepeatableRead" },
    ),
    loadExamWork({ goalId, today }),
  ]);

  const older = total - rows.length;

  const finished = rows
    .toReversed()
    .flatMap((row, index) => readFinishedMock({ number: older + index + 1, row }) ?? []);

  const mocks = finished
    .map((mock) => toMockSummary(mock))
    .toReversed()
    .slice(0, HISTORY_SIZE);

  // The exam's latest penalty sets the break-even the advice reads against.
  const penalty = finished.at(-1)?.result.net?.penalty ?? 1;

  return {
    calibration: calibration
      ? { ...calibration, ...sumCalibration({ calibrations: [calibration], penalty }) }
      : null,
    mocks,
    progress: getMockProgress(finished),
    ...work,
  };
}
