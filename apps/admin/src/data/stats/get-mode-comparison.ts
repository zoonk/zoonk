import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import {
  getLearnerActivityDaysSql,
  learnerRetentionSql,
} from "@/data/stats/_utils/learner-activity";
import {
  getModeLearnersSql,
  modeLearnerTotalsSql,
  modeStratumSumsSql,
} from "@/data/stats/_utils/mode-comparison-sql";
import { type ModeStratumRow, compareMatchedModes } from "@/data/stats/_utils/mode-matching";
import { prisma } from "@zoonk/db";

/**
 * Focus against Fun for learners who signed up in the period, matched exactly on goal kind, age
 * band, locale and signup week.
 */
export const getModeComparison = cacheAdminData(async (start: Date, end: Date) => {
  const rows = await prisma.$queryRaw<ModeStratumRow[]>`
    WITH
    ${getModeLearnersSql({ end, start })},
    cohort AS (SELECT learners.user_id, learners.signup_date FROM learners),
    activity AS (
      SELECT days.user_id, days.activity_date
      FROM (${getLearnerActivityDaysSql({ end: new Date(), start })}) days
      WHERE days.user_id IN (SELECT learners.user_id FROM learners)
    ),
    retention AS (${learnerRetentionSql}),
    ${modeLearnerTotalsSql}
    ${modeStratumSumsSql}
  `;

  return compareMatchedModes(rows);
});
