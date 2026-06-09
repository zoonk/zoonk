import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { trackedAnalyticsUserSql } from "@/data/stats/_utils/analytics-user-filter";
import { type LearnerMilestoneKind } from "@/lib/learner-milestone-filters";
import { type Sql, prisma, sql } from "@zoonk/db";

type LearnerMilestoneUserRow = {
  completedLessons: bigint;
  createdAt: Date;
  email: string;
  id: string;
  lastCompletedAt: Date;
  learningDays: bigint;
  name: string;
  totalBrainPower: bigint;
  username: string | null;
};

type LearnerMilestoneQueryParts = { havingFilter: Sql; primaryOrder: Sql };

export type LearnerMilestoneUser = {
  completedLessons: number;
  createdAt: Date;
  email: string;
  id: string;
  lastCompletedAt: Date;
  learningDays: number;
  name: string;
  totalBrainPower: number;
  username: string | null;
};

/**
 * The engagement page needs the two milestone counts together so it can answer
 * the threshold questions without making each card own a separate data path.
 */
export const getLearnerMilestoneSummary = cacheAdminData(
  async (completedLessonsThreshold: number, learningDaysThreshold: number) => {
    const [completedLessonsUsers, learningDaysUsers] = await Promise.all([
      countUsersByLearnerMilestone({
        queryParts: getLearnerMilestoneQueryParts({
          kind: "completedLessons",
          threshold: completedLessonsThreshold,
        }),
      }),
      countUsersByLearnerMilestone({
        queryParts: getLearnerMilestoneQueryParts({
          kind: "learningDays",
          threshold: learningDaysThreshold,
        }),
      }),
    ]);

    return { completedLessonsUsers, learningDaysUsers };
  },
);

/**
 * The drill-down page uses one route for both learner milestone questions. The
 * kind decides which threshold rule filters users, while each row still shows
 * both completion totals for context.
 */
export const listLearnerMilestoneUsers = cacheAdminData(
  async (kind: LearnerMilestoneKind, threshold: number, limit: number, offset: number) => {
    const queryParts = getLearnerMilestoneQueryParts({ kind, threshold });

    const [rows, total] = await Promise.all([
      listUsersByLearnerMilestone({ limit, offset, queryParts }),
      countUsersByLearnerMilestone({ queryParts }),
    ]);

    const users = rows.map((row) => serializeLearnerMilestoneUser({ row }));

    return { total, users };
  },
);

/**
 * Raw SQL cannot parameterize aggregate expressions or order columns, so the
 * supported milestone rules are explicitly whitelisted before being composed
 * into the shared learner-progress query.
 */
function getLearnerMilestoneQueryParts({
  kind,
  threshold,
}: {
  kind: LearnerMilestoneKind;
  threshold: number;
}): LearnerMilestoneQueryParts {
  if (kind === "learningDays") {
    return {
      havingFilter: sql`COUNT(DISTINCT completed_at::date) >= ${threshold}`,
      primaryOrder: sql`learner_progress.learning_days DESC, learner_progress.completed_lessons DESC`,
    };
  }

  return {
    havingFilter: sql`COUNT(*) >= ${threshold}`,
    primaryOrder: sql`learner_progress.completed_lessons DESC, learner_progress.learning_days DESC`,
  };
}

/**
 * Counting inside a grouped subquery lets Postgres apply the milestone rule per
 * user before the outer count turns the qualifying user set into one metric.
 */
async function countUsersByLearnerMilestone({
  queryParts,
}: {
  queryParts: LearnerMilestoneQueryParts;
}) {
  const result = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) AS count
    FROM (
      SELECT user_id
      FROM lesson_progress
      JOIN users ON users.id = lesson_progress.user_id
      WHERE ${trackedAnalyticsUserSql} AND completed_at IS NOT NULL
      GROUP BY user_id
      HAVING ${queryParts.havingFilter}
    ) qualifying_users
  `;

  return Number(result[0].count);
}

/**
 * The user list shares one learner-progress subquery for both milestones. The
 * whitelisted query parts decide which users qualify and which metric sorts
 * first, while every row still exposes both completion counts.
 */
async function listUsersByLearnerMilestone({
  limit,
  offset,
  queryParts,
}: {
  limit: number;
  offset: number;
  queryParts: LearnerMilestoneQueryParts;
}) {
  return prisma.$queryRaw<LearnerMilestoneUserRow[]>`
    SELECT
      users.id,
      users.name,
      users.email,
      users.username,
      users.created_at AS "createdAt",
      COALESCE(user_progress.total_brain_power, 0)::bigint AS "totalBrainPower",
      learner_progress.completed_lessons AS "completedLessons",
      learner_progress.learning_days AS "learningDays",
      learner_progress.last_completed_at AS "lastCompletedAt"
    FROM (
      SELECT
        user_id,
        COUNT(*) AS completed_lessons,
        COUNT(DISTINCT completed_at::date) AS learning_days,
        MAX(completed_at) AS last_completed_at
      FROM lesson_progress
      JOIN users ON users.id = lesson_progress.user_id
      WHERE ${trackedAnalyticsUserSql} AND completed_at IS NOT NULL
      GROUP BY user_id
      HAVING ${queryParts.havingFilter}
    ) learner_progress
    JOIN users ON users.id = learner_progress.user_id
    LEFT JOIN user_progress ON user_progress.user_id = users.id
    ORDER BY
      ${queryParts.primaryOrder},
      learner_progress.last_completed_at DESC,
      users.created_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;
}

/**
 * Raw SQL returns bigint values for counts and Brain Power. Converting them at
 * the data boundary keeps table components free from database numeric details.
 */
function serializeLearnerMilestoneUser({
  row,
}: {
  row: LearnerMilestoneUserRow;
}): LearnerMilestoneUser {
  return {
    completedLessons: Number(row.completedLessons),
    createdAt: row.createdAt,
    email: row.email,
    id: row.id,
    lastCompletedAt: row.lastCompletedAt,
    learningDays: Number(row.learningDays),
    name: row.name,
    totalBrainPower: Number(row.totalBrainPower),
    username: row.username,
  };
}
