import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { type MockResult } from "../../mocks/mock-contract";

type CalibrationTotals = {
  blankingGain: number;
  count: number;
  sureAnswered: number;
  sureRight: number;
  unsureAnswered: number;
  unsureRight: number;
};

export async function loadExamCalibration({
  goalId,
  transaction,
}: {
  goalId: string;
  transaction: TransactionClient;
}): Promise<Omit<NonNullable<MockResult["calibration"]>, "advice"> | null> {
  const [totals] = await transaction.$queryRaw<CalibrationTotals[]>`
    SELECT count(*)::int AS count,
      sum((result #>> '{calibration,blankingGain}')::numeric)::float8 AS "blankingGain",
      sum((result #>> '{calibration,sure,answered}')::numeric)::float8 AS "sureAnswered",
      sum((result #>> '{calibration,sure,right}')::numeric)::float8 AS "sureRight",
      sum((result #>> '{calibration,unsure,answered}')::numeric)::float8 AS "unsureAnswered",
      sum((result #>> '{calibration,unsure,right}')::numeric)::float8 AS "unsureRight"
    FROM mock_exams
    WHERE goal_id = ${goalId}::uuid AND status = 'finished' AND finished_at IS NOT NULL
      AND jsonb_typeof(result #> '{calibration,blankingGain}') = 'number'
      AND jsonb_typeof(result #> '{calibration,sure,answered}') = 'number'
      AND jsonb_typeof(result #> '{calibration,sure,right}') = 'number'
      AND jsonb_typeof(result #> '{calibration,unsure,answered}') = 'number'
      AND jsonb_typeof(result #> '{calibration,unsure,right}') = 'number'
  `;

  if (!totals || totals.count === 0) {
    return null;
  }

  return {
    blankingGain: totals.blankingGain,
    sure: { answered: totals.sureAnswered, right: totals.sureRight },
    unsure: { answered: totals.unsureAnswered, right: totals.unsureRight },
  };
}
