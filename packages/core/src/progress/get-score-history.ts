import "server-only";
import { prisma } from "@zoonk/db";
import { formatLabel } from "@zoonk/utils/chart";
import { getProgressSession } from "./_utils/progress-cache";
import { getRequestProgressDateContext } from "./get-request-date-context";
import { type ScoreDateRange, getScoreDateRange } from "./score-date-range";
import {
  type DatedAnswerCounts,
  type DatedScorePerformance,
  type ScorePerformance,
  getCombinedScorePerformance,
  getWeeklyScorePerformance,
} from "./score-performance";

type ScoreTrendDataPoint = DatedScorePerformance & { label: string };

export type ScoreHistoryData = ScorePerformance & {
  dataPoints: ScoreTrendDataPoint[];
  periodEnd: Date;
  periodStart: Date;
};

export type ScoreHistoryResource = ScorePerformance & {
  dataPoints: DatedScorePerformance[];
  periodEnd: Date;
  periodStart: Date;
};

type CurrentUserScoreHistoryResource =
  | { isAuthenticated: false }
  | { isAuthenticated: true; score: ScoreHistoryResource | null };

/**
 * Converts one DailyProgress row into the answer-count shape used by weighted
 * Score aggregation without coupling the pure helper to Prisma models.
 */
function toDatedAnswerCounts(row: DatedAnswerCounts): DatedAnswerCounts {
  return {
    correctAnswers: row.correctAnswers,
    date: row.date,
    incorrectAnswers: row.incorrectAnswers,
  };
}

/**
 * Builds one rolling Score result from the same rows used by its weekly trend,
 * guaranteeing the headline and chart cannot drift to different denominators.
 */
function buildScoreHistory({
  endDate,
  rows,
  startDate,
}: {
  endDate: Date;
  rows: DatedAnswerCounts[];
  startDate: Date;
}): ScoreHistoryResource | null {
  const performance = getCombinedScorePerformance(rows);

  if (!performance) {
    return null;
  }

  const dataPoints = getWeeklyScorePerformance(rows);

  return { ...performance, dataPoints, periodEnd: endDate, periodStart: startDate };
}

/**
 * Reads already-resolved date-only boundaries under one progress cache key.
 * Resolving the request timezone before this leaf keeps request APIs out of the
 * shared cache while every locale can reuse the same persistence rows.
 */
async function findScoreHistoryRows({
  endDate,
  startDate,
  userId,
}: {
  endDate: Date;
  startDate: Date;
  userId: string;
}): Promise<DatedAnswerCounts[]> {
  const rows = await prisma.dailyProgress.findMany({
    orderBy: { date: "asc" },
    where: { date: { gte: startDate, lte: endDate }, userId },
  });

  return rows.map((row) => toDatedAnswerCounts(row));
}

/**
 * Loads the authenticated learner's raw rolling Score resource once so server
 * UI callers can add localized labels while API callers preserve date-only
 * values without generating or discarding presentation text.
 */
async function getCurrentUserScoreHistoryResource(): Promise<CurrentUserScoreHistoryResource> {
  "use cache: private";

  const [session, dateContext] = await Promise.all([
    getProgressSession(),
    getRequestProgressDateContext(),
  ]);

  if (!session) {
    return { isAuthenticated: false };
  }

  const dateRange: ScoreDateRange = getScoreDateRange({
    now: dateContext.currentInstant,
    timeZone: dateContext.timeZone,
  });

  const rows = await findScoreHistoryRows({ ...dateRange.dailyProgress, userId: session.user.id });
  const score = buildScoreHistory({ ...dateRange.dailyProgress, rows });

  return { isAuthenticated: true, score };
}

/**
 * Adds locale-specific chart labels to a raw Score resource for server-rendered
 * web surfaces without making localization part of the shared API contract.
 */
function localizeScoreHistory({
  locale,
  score,
}: {
  locale: string;
  score: ScoreHistoryResource;
}): ScoreHistoryData {
  const dataPoints = score.dataPoints.map((point) => ({
    ...point,
    label: formatLabel(point.date, "month", locale),
  }));

  return { ...score, dataPoints };
}

/**
 * Returns the learner's weighted rolling Score and localized weekly trend.
 * Every locale reads the same fixed 90-day answer window.
 */
export async function getScoreHistory({
  locale,
}: {
  locale: string;
}): Promise<ScoreHistoryData | null> {
  "use cache: private";

  const resource = await getCurrentUserScoreHistoryResource();

  if (!resource.isAuthenticated || !resource.score) {
    return null;
  }

  return localizeScoreHistory({ locale, score: resource.score });
}

/**
 * Exposes Score as an authenticated resource while keeping the existing null
 * state for learners who have not answered a question in the rolling window
 * and omitting every locale-specific presentation field.
 */
export async function getCurrentUserScore(): Promise<{
  score: ScoreHistoryResource | null;
} | null> {
  const resource = await getCurrentUserScoreHistoryResource();

  return resource.isAuthenticated ? { score: resource.score } : null;
}
