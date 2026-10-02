import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import {
  trackedAnalyticsUserRelationWhere,
  trackedAnalyticsUserSql,
} from "@/data/stats/_utils/analytics-user-filter";
import { getStatsDateBucketSql } from "@/data/stats/_utils/stats-date-bucket";
import { prisma, sql } from "@zoonk/db";
import { type HistoryPeriod } from "@zoonk/utils/date-ranges";

/**
 * Learner skills that are solid or mastered now, by the date of the review that last confirmed
 * them. A learner skill keeps only its current state, so the moment a skill first reached a
 * state comes from PostHog's `Skill Level Changed`.
 */
export const getMasteryTrend = cacheAdminData(
  async (start: Date, end: Date, period: HistoryPeriod) => {
    const dateBucketSql = getStatsDateBucketSql({
      date: sql`learner_skills.last_reviewed_at`,
      period,
    });

    return prisma.$queryRaw<{ date: Date; mastered: number; solid: number }[]>`
      SELECT
        ${dateBucketSql} AS date,
        COUNT(*) FILTER (WHERE learner_skills.state = 'solid')::int AS solid,
        COUNT(*) FILTER (WHERE learner_skills.state = 'mastered')::int AS mastered
      FROM learner_skills
      JOIN users ON users.id = learner_skills.user_id
      WHERE
        ${trackedAnalyticsUserSql}
        AND learner_skills.state IN ('solid', 'mastered')
        AND learner_skills.last_reviewed_at >= ${start}
        AND learner_skills.last_reviewed_at <= ${end}
      GROUP BY ${dateBucketSql}
      ORDER BY ${dateBucketSql} ASC
    `;
  },
);

/** Every tracked learner skill by its current state, in mastery order. */
export const countLearnerSkillsByState = cacheAdminData(async () => {
  const rows = await prisma.learnerSkill.groupBy({
    _count: { state: true },
    by: ["state"],
    orderBy: { state: "asc" },
    where: trackedAnalyticsUserRelationWhere,
  });

  return rows.map((row) => ({ count: row._count.state, state: row.state }));
});
