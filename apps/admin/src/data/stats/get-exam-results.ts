import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { trackedAnalyticsUserSql } from "@/data/stats/_utils/analytics-user-filter";
import { prisma } from "@zoonk/db";

type ExamResultRow = {
  /** Official score minus the middle of the estimate, on reports with both on the same scale. */
  avgEstimateError: number | null;
  avgMocks: number;
  examName: string;
  passed: number;
  reports: number;
  withEstimate: number;
  withinEstimate: number;
};

/**
 * Official results learners reported after their exam ("How did it go?") in the period, by exam:
 * how many passed, how many had an estimate before the exam and how often the official score
 * landed inside it, the average error, and how many mocks they had taken.
 */
export const getExamResults = cacheAdminData(
  async (start: Date, end: Date) =>
    prisma.$queryRaw<ExamResultRow[]>`
    SELECT
      exam_results.exam_name AS "examName",
      COUNT(*)::int AS reports,
      COUNT(*) FILTER (WHERE exam_results.passed)::int AS passed,
      COUNT(*) FILTER (
        WHERE exam_results.score IS NOT NULL AND exam_results.estimate_low IS NOT NULL
      )::int AS "withEstimate",
      COUNT(*) FILTER (
        WHERE exam_results.score BETWEEN exam_results.estimate_low AND exam_results.estimate_high
      )::int AS "withinEstimate",
      AVG(
        exam_results.score - (exam_results.estimate_low + exam_results.estimate_high) / 2
      )::float AS "avgEstimateError",
      AVG(exam_results.mocks_taken)::float AS "avgMocks"
    FROM exam_results
    JOIN users ON users.id = exam_results.user_id
    WHERE
      ${trackedAnalyticsUserSql}
      AND exam_results.reported_at >= ${start}
      AND exam_results.reported_at <= ${end}
    GROUP BY exam_results.exam_name
    ORDER BY reports DESC
  `,
);
