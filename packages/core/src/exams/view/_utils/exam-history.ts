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

const HISTORY_SIZE = 10;

export async function loadExamHistory({
  goalId,
  today,
}: {
  goalId: string;
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
