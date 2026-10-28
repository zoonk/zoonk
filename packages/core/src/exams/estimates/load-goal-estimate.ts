import "server-only";
import { type ExamBlueprint, type Goal, prisma } from "@zoonk/db";
import { examReportsSql } from "@zoonk/db/anonymous-records";
import { isJsonObject } from "@zoonk/utils/json";
import {
  type EstimatedScore,
  type RecentMockEvidence,
  canEstimateScore,
  countRecentQuestions,
  estimateScoreRange,
} from "../../preparation/estimated-score";
import { type MockResult as LedgerMock, RECENT_MOCKS } from "../../preparation/preparation-math";
import { mockResultSchema, mockShapeSchema } from "../mocks/mock-contract";
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

  const scales = scale === "percent" ? ["percent", "points"] : [scale];

  const rows = await prisma.$queryRaw<ReportRow[]>`
    SELECT score, scale, max_score AS "maxScore", estimate_low AS "estimateLow",
      estimate_high AS "estimateHigh"
    FROM ${examReportsSql(examBlueprintId)} r
    WHERE scale = ANY(${scales}::text[])
    ORDER BY reported_at DESC
    LIMIT ${CALIBRATION_REPORTS}`;

  return rows.flatMap((row) => toReportedResult(row));
}

async function loadExamScale(
  goal: Pick<Goal, "examBlueprintId" | "title">,
  knownBlueprint: Pick<ExamBlueprint, "identityKey" | "name"> | null | undefined,
): Promise<ExamScale | null> {
  const blueprint =
    knownBlueprint === undefined && goal.examBlueprintId
      ? await prisma.examBlueprint.findUnique({
          select: { identityKey: true, name: true },
          where: { id: goal.examBlueprintId },
        })
      : (knownBlueprint ?? null);

  return getExamScale({ blueprint, goal });
}

function loadRecentMocks(goalId: string) {
  return prisma.mockExam.findMany({
    orderBy: { finishedAt: "desc" },
    select: { conditions: true, result: true },
    take: RECENT_MOCKS,
    where: { goalId, status: "finished" },
  });
}

type RecentMock = Awaited<ReturnType<typeof loadRecentMocks>>[number];

function getIrtAbilities(mocks: readonly RecentMock[]) {
  return mocks.flatMap((mock) => {
    const irt = mockResultSchema.safeParse(mock.result).data?.irt;
    return irt ? [{ se: irt.se, theta: irt.theta }] : [];
  });
}

function countMockQuestions(result: unknown): number {
  return isJsonObject(result) && typeof result.total === "number" ? result.total : 0;
}

function readMockShape(conditions: unknown) {
  return mockShapeSchema.safeParse(isJsonObject(conditions) ? conditions.shape : null).data ?? null;
}

function getRecentMockEvidence({
  ledgerMocks,
  mocks,
}: {
  ledgerMocks: readonly LedgerMock[];
  mocks: readonly RecentMock[];
}): RecentMockEvidence {
  const sitting = mocks.reduce((sum, mock) => sum + countMockQuestions(mock.result), 0);

  return {
    questions: Math.max(sitting, countRecentQuestions(ledgerMocks)),
    subjectOnly:
      mocks.length > 0 && mocks.every((mock) => readMockShape(mock.conditions)?.kind === "area"),
  };
}

export async function loadGoalScoreEstimate({
  blueprint,
  goal,
  ledgerMocks,
}: {
  blueprint?: Pick<ExamBlueprint, "identityKey" | "name"> | null;
  goal: Pick<Goal, "examBlueprintId" | "id" | "title">;
  ledgerMocks: readonly LedgerMock[];
}): Promise<EstimatedScore | null> {
  const mocks = await loadRecentMocks(goal.id);

  if (!canEstimateScore(getRecentMockEvidence({ ledgerMocks, mocks }))) {
    return null;
  }

  const examScale = await loadExamScale(goal, blueprint);
  const abilities = examScale ? [] : getIrtAbilities(mocks);
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
