import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { trackedAnalyticsUserSql } from "@/data/stats/_utils/analytics-user-filter";
import { getStatsDateBucketSql } from "@/data/stats/_utils/stats-date-bucket";
import { PASS_SHARE } from "@zoonk/core/checkpoints/rules";
import { prisma, sql } from "@zoonk/db";
import { type HistoryPeriod } from "@zoonk/utils/date-ranges";

type CheckpointOutcomeKind = "checkpoint" | "mock";

export type CheckpointOutcomeRow = {
  answers: number;
  correct: number;
  date: Date;
  finished: number;
  passed: number;
};

/**
 * Finished checkpoints (bosses and weekly challenges) or mocks (an exam's Big Challenge) per
 * bucket, from the ledger: how many, their answers, and how many reached the pass mark (the
 * `CEIL(questions * PASS_SHARE)` core's `getPassMark` applies).
 */
export const getCheckpointOutcomeTrend = cacheAdminData(
  async (kind: CheckpointOutcomeKind, start: Date, end: Date, period: HistoryPeriod) => {
    const dateBucketSql = getStatsDateBucketSql({ date: sql`learning_events.ended_at`, period });

    return prisma.$queryRaw<CheckpointOutcomeRow[]>`
      SELECT
        ${dateBucketSql} AS date,
        COUNT(*)::int AS finished,
        SUM(learning_events.correct_answers)::int AS correct,
        SUM(learning_events.correct_answers + learning_events.incorrect_answers)::int AS answers,
        COUNT(*) FILTER (
          WHERE learning_events.correct_answers >= CEIL(
            (learning_events.correct_answers + learning_events.incorrect_answers)
            * ${PASS_SHARE}::float
          )
        )::int AS passed
      FROM learning_events
      JOIN users ON users.id = learning_events.user_id
      WHERE
        ${trackedAnalyticsUserSql}
        AND learning_events.kind = ${kind}::"LearningEventKind"
        AND learning_events.ended_at >= ${start}
        AND learning_events.ended_at <= ${end}
      GROUP BY ${dateBucketSql}
      ORDER BY ${dateBucketSql} ASC
    `;
  },
);
