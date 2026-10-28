import "server-only";
import { prisma } from "@zoonk/db";
import { formatLabel } from "@zoonk/utils/chart";
import {
  type ProgressHistoryOptions,
  dailyProgressInWindow,
  readLifetimeDailyProgress,
} from "./_utils/daily-progress-rows";
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

function toDatedAnswerCounts(row: DatedAnswerCounts): DatedAnswerCounts {
  return {
    correctAnswers: row.correctAnswers,
    date: row.date,
    incorrectAnswers: row.incorrectAnswers,
  };
}

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

async function getCurrentUserScoreHistoryResource({
  history,
}: ProgressHistoryOptions = {}): Promise<CurrentUserScoreHistoryResource> {
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

  const rows =
    history === "lifetime"
      ? dailyProgressInWindow({
          ...dateRange,
          rows: await readLifetimeDailyProgress(session.user.id),
        })
      : await findScoreHistoryRows({ ...dateRange, userId: session.user.id });

  const score = buildScoreHistory({ ...dateRange, rows });

  return { isAuthenticated: true, score };
}

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

/** Uses exactly 90 learner-local dates for every locale; null without answers or a session. */
export async function getScoreHistory({
  locale,
  history,
}: ProgressHistoryOptions & { locale: string }): Promise<ScoreHistoryData | null> {
  "use cache: private";

  const resource = history
    ? await getCurrentUserScoreHistoryResource({ history })
    : await getCurrentUserScoreHistoryResource();

  if (!resource.isAuthenticated || !resource.score) {
    return null;
  }

  return localizeScoreHistory({ locale, score: resource.score });
}

/** Outer null means unauthenticated; score=null means no answers in the window. Omits localized labels. */
export async function getCurrentUserScore(): Promise<{
  score: ScoreHistoryResource | null;
} | null> {
  const resource = await getCurrentUserScoreHistoryResource();

  return resource.isAuthenticated ? { score: resource.score } : null;
}
