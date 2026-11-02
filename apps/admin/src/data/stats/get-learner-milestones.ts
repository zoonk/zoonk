import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import {
  completedLessonActivitySql,
  trackedAnalyticsUserSql,
} from "@/data/stats/_utils/analytics-user-filter";
import { type LearnerMilestoneKind } from "@/lib/learner-milestone-filters";
import { type Sql, prisma, sql } from "@zoonk/db";

type LearnerMilestoneUserRow = {
  completedLessons: bigint;
  createdAt: Date;
  email: string;
  id: string;
  lastLearningDate: Date;
  learningDays: bigint;
  name: string;
  totalBrainPower: bigint;
  username: string | null;
};

type LearnerMilestoneQueryParts = { havingFilter: Sql; primaryOrder: Sql };

const completedLessonsSql = sql`SUM(daily_progress.lessons_completed)`;
const learningDaysSql = sql`COUNT(*)`;

export type LearnerMilestoneUser = {
  completedLessons: number;
  createdAt: Date;
  email: string;
  id: string;
  lastLearningDate: Date;
  learningDays: number;
  name: string;
  totalBrainPower: number;
  username: string | null;
};

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
 * Raw SQL can't parameterize aggregate expressions or order columns, so the supported rules are
 * whitelisted.
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
      havingFilter: sql`${learningDaysSql} >= ${threshold}`,
      primaryOrder: sql`learner_progress.learning_days DESC, learner_progress.completed_lessons DESC`,
    };
  }

  return {
    havingFilter: sql`${completedLessonsSql} >= ${threshold}`,
    primaryOrder: sql`learner_progress.completed_lessons DESC, learner_progress.learning_days DESC`,
  };
}

async function countUsersByLearnerMilestone({
  queryParts,
}: {
  queryParts: LearnerMilestoneQueryParts;
}) {
  const result = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) AS count
    FROM (
      SELECT user_id
      FROM daily_progress
      JOIN users ON users.id = daily_progress.user_id
      WHERE ${trackedAnalyticsUserSql} AND ${completedLessonActivitySql}
      GROUP BY user_id
      HAVING ${queryParts.havingFilter}
    ) qualifying_users
  `;

  return Number(result[0].count);
}

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
      learner_progress.last_learning_date AS "lastLearningDate"
    FROM (
      SELECT
        user_id,
        ${completedLessonsSql} AS completed_lessons,
        ${learningDaysSql} AS learning_days,
        MAX(daily_progress.date) AS last_learning_date
      FROM daily_progress
      JOIN users ON users.id = daily_progress.user_id
      WHERE ${trackedAnalyticsUserSql} AND ${completedLessonActivitySql}
      GROUP BY user_id
      HAVING ${queryParts.havingFilter}
    ) learner_progress
    JOIN users ON users.id = learner_progress.user_id
    LEFT JOIN user_progress ON user_progress.user_id = users.id
    ORDER BY
      ${queryParts.primaryOrder},
      learner_progress.last_learning_date DESC,
      users.created_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;
}

/** Raw SQL returns bigint values for counts and Brain Power. */
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
    lastLearningDate: row.lastLearningDate,
    learningDays: Number(row.learningDays),
    name: row.name,
    totalBrainPower: Number(row.totalBrainPower),
    username: row.username,
  };
}
