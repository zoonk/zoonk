import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { type EstimatedScore, estimateScoreRange } from "../../preparation/estimated-score";
import { type MockResult as LedgerMock, RECENT_MOCKS } from "../../preparation/preparation-math";
import { mockResultSchema } from "../mocks/mock-contract";
import { pointsToPercent } from "../results/exam-result-contract";
import {
  type ExamScale,
  getExamScale,
  percentToExamScale,
  roundToExamScale,
} from "../scoring/exam-scales";
import {
  type ReportedResult,
  calibrateRange,
  estimateIrtRange,
  getEstimateCalibration,
} from "./score-estimate";

/** Calibration reads the exam's most recent official results. */
const CALIBRATION_REPORTS = 200;
const MAX_PERCENT = 100;

function toPercent(value: number): number {
  return Math.min(MAX_PERCENT, Math.max(0, Math.round(value)));
}

type ReportRow = {
  estimateHigh: number | null;
  estimateLow: number | null;
  maxScore: number | null;
  scale: string | null;
  score: number | null;
};

/** A report on the estimate's scale: points out of a maximum read as percent, like the estimate. */
function toReportedResult(row: ReportRow): ReportedResult[] {
  if (row.score === null || row.estimateLow === null || row.estimateHigh === null) {
    return [];
  }

  if (row.scale !== "points") {
    return [{ estimateHigh: row.estimateHigh, estimateLow: row.estimateLow, official: row.score }];
  }

  if (!row.maxScore) {
    return [];
  }

  const { maxScore } = row;

  return [
    {
      estimateHigh: pointsToPercent({ maxScore, points: row.estimateHigh }),
      estimateLow: pointsToPercent({ maxScore, points: row.estimateLow }),
      official: pointsToPercent({ maxScore, points: row.score }),
    },
  ];
}

/**
 * Official results reported for the exam on the estimate's scale, with the estimate shown before.
 * Percent estimates also learn from scores reported in points out of a known maximum.
 */
async function loadReports({
  examBlueprintId,
  scale,
}: {
  examBlueprintId: string | null;
  scale: EstimatedScore["scale"];
}): Promise<ReportedResult[]> {
  if (!examBlueprintId) {
    return [];
  }

  const rows = await prisma.examResult.findMany({
    orderBy: { reportedAt: "desc" },
    select: { estimateHigh: true, estimateLow: true, maxScore: true, scale: true, score: true },
    take: CALIBRATION_REPORTS,
    where: {
      estimateHigh: { not: null },
      estimateLow: { not: null },
      examBlueprintId,
      scale: { in: scale === "percent" ? ["percent", "points"] : [scale] },
      score: { not: null },
    },
  });

  return rows.flatMap((row) => toReportedResult(row));
}

/** The scale the goal's exam reports on (SAT, AP, TOEFL), from its blueprint or title. */
async function loadExamScale(
  goal: Pick<Goal, "examBlueprintId" | "title">,
): Promise<ExamScale | null> {
  const blueprint = goal.examBlueprintId
    ? await prisma.examBlueprint.findUnique({
        select: { identityKey: true, name: true },
        where: { id: goal.examBlueprintId },
      })
    : null;

  return getExamScale({ blueprint, goal });
}

/** Abilities from the goal's latest mocks scored with item response theory. */
async function loadIrtAbilities(goalId: string) {
  const mocks = await prisma.mockExam.findMany({
    orderBy: { finishedAt: "desc" },
    select: { result: true },
    take: RECENT_MOCKS,
    where: { goalId, status: "finished" },
  });

  return mocks.flatMap((mock) => {
    const irt = mockResultSchema.safeParse(mock.result).data?.irt;
    return irt ? [{ se: irt.se, theta: irt.theta }] : [];
  });
}

/**
 * The goal's estimated score, only after a mock: on the exam's own scale for exams that report on
 * one (SAT, AP, TOEFL), on its item response theory scale when its mocks are scored that way
 * (ENEM), otherwise as percent correct. Once enough learners report official results for the
 * exam, the range is calibrated against them.
 */
export async function loadGoalScoreEstimate({
  goal,
  ledgerMocks,
}: {
  goal: Pick<Goal, "examBlueprintId" | "id" | "title">;
  /** Finished mocks from the ledger: right and wrong answers, for the percent estimate. */
  ledgerMocks: readonly LedgerMock[];
}): Promise<EstimatedScore | null> {
  const examScale = await loadExamScale(goal);
  const abilities = examScale ? [] : await loadIrtAbilities(goal.id);
  const scale: EstimatedScore["scale"] = examScale ?? (abilities.length > 0 ? "irt" : "percent");
  const reports = await loadReports({ examBlueprintId: goal.examBlueprintId, scale });
  const calibration = getEstimateCalibration(reports);

  if (scale === "irt") {
    const range = estimateIrtRange({ abilities, calibration });

    return range
      ? { ...range, calibrated: calibration !== null, mocks: abilities.length, scale }
      : null;
  }

  const percent = estimateScoreRange(ledgerMocks);

  if (!percent) {
    return null;
  }

  if (scale === "percent") {
    const range = calibrateRange({ calibration, range: percent, round: toPercent });
    return { ...percent, ...range, calibrated: calibration !== null };
  }

  const range = calibrateRange({
    calibration,
    range: percentToExamScale({ range: percent, scale }),
    round: (value) => roundToExamScale({ scale, value }),
  });

  return { ...percent, ...range, calibrated: calibration !== null, scale };
}
