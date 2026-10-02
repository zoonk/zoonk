import {
  getActiveLearnerAverages,
  getActiveLearnerRhythmTrend,
} from "@/data/stats/get-active-learner-rhythm";
import { getStudySessionTrend } from "@/data/stats/get-study-session-trend";
import { formatPercent } from "@/lib/format";
import { AdminAnalysisTrend } from "../_components/admin-analysis-trend";
import { AdminMetricTrendChart } from "../_components/admin-metric-trend-chart";
import { buildMetricTrend, sumRows, toPercent, toRatePoints } from "../_utils/metric-trend";
import { type LearningAnalysisView } from "../_utils/stats-analysis";
import { type StatsPeriod } from "../_utils/stats-period";
import { MasteryAnalysis } from "./mastery-analysis";
import { MinutesVsGoalAnalysis } from "./minutes-vs-goal-analysis";
import { RetentionAnalysis } from "./retention-analysis";

type Rhythm = "daily" | "weekly";

const RHYTHM_COPY = {
  daily: {
    description:
      "Average learners per day who finished a lesson, review, practice, checkpoint or session, or logged study time. Each bar averages the days in its bucket.",
    label: "Daily active learners",
  },
  weekly: {
    description:
      "Average learners active in the 7 days ending on each day. Each bar averages the days in its bucket.",
    label: "Weekly active learners",
  },
} as const satisfies Record<Rhythm, { description: string; label: string }>;

/** Loads one Learning question at a time. */
export async function LearningMetrics({
  statsPeriod,
  view,
}: {
  statsPeriod: StatsPeriod;
  view: LearningAnalysisView;
}) {
  "use cache: private";

  if (view.id === "weekly-active-learners") {
    return <ActiveLearnerRhythmAnalysis rhythm="weekly" statsPeriod={statsPeriod} />;
  }

  if (view.id === "sessions-finished") {
    return <SessionsAnalysis statsPeriod={statsPeriod} />;
  }

  if (view.id === "minutes-vs-goal") {
    return <MinutesVsGoalAnalysis statsPeriod={statsPeriod} />;
  }

  if (view.id === "retention") {
    return <RetentionAnalysis statsPeriod={statsPeriod} />;
  }

  if (view.id === "mastery-growth") {
    return <MasteryAnalysis statsPeriod={statsPeriod} />;
  }

  return <ActiveLearnerRhythmAnalysis rhythm="daily" statsPeriod={statsPeriod} />;
}

/**
 * Daily and weekly actives are averages over the period's days (from the first activity to
 * today), so periods of different lengths compare fairly.
 */
async function ActiveLearnerRhythmAnalysis({
  rhythm,
  statsPeriod,
}: {
  rhythm: Rhythm;
  statsPeriod: StatsPeriod;
}) {
  const { chartPeriod, comparisonLabel, current, previous } = statsPeriod;

  const [currentAverages, previousAverages, trend] = await Promise.all([
    getActiveLearnerAverages(current.start, current.end),
    getActiveLearnerAverages(previous.start, previous.end),
    getActiveLearnerRhythmTrend(current.start, current.end, chartPeriod),
  ]);

  const dataPoints = buildMetricTrend({
    emptyValue: 0,
    points: trend.map((row) => ({ count: row[rhythm] ?? 0, date: row.date })),
    statsPeriod,
  });

  const value = currentAverages[rhythm];

  return (
    <AdminAnalysisTrend
      comparison={{ comparisonLabel, current: value, previous: previousAverages[rhythm] }}
      description={RHYTHM_COPY[rhythm].description}
      value={value.toLocaleString("en", { maximumFractionDigits: 1 })}
    >
      <AdminMetricTrendChart
        dataPoints={dataPoints}
        label={RHYTHM_COPY[rhythm].label}
        valueFormat="number"
      />
    </AdminAnalysisTrend>
  );
}

/**
 * A session is finished when every block is done or skipped. The rate uses sessions that were
 * started, since a planned session nobody opened says nothing about finishing.
 */
async function SessionsAnalysis({ statsPeriod }: { statsPeriod: StatsPeriod }) {
  const { chartPeriod, comparisonLabel, current, previous } = statsPeriod;

  const [currentRows, previousRows] = await Promise.all([
    getStudySessionTrend(current.start, current.end, chartPeriod),
    getStudySessionTrend(previous.start, previous.end, chartPeriod),
  ]);

  const started = sumRows({ rows: currentRows, value: (row) => row.started });
  const completed = sumRows({ rows: currentRows, value: (row) => row.completed });
  const rate = toPercent({ denominator: started, numerator: completed });

  const previousRate = toPercent({
    denominator: sumRows({ rows: previousRows, value: (row) => row.started }),
    numerator: sumRows({ rows: previousRows, value: (row) => row.completed }),
  });

  const dataPoints = buildMetricTrend({
    emptyValue: null,
    points: toRatePoints({
      denominator: (row) => row.started,
      numerator: (row) => row.completed,
      rows: currentRows,
    }),
    statsPeriod,
  });

  return (
    <AdminAnalysisTrend
      comparison={{ comparisonLabel, current: rate ?? 0, previous: previousRate ?? 0 }}
      description={`${completed.toLocaleString()} of ${started.toLocaleString()} started study sessions were finished (every block done or skipped), by the learner's local date.`}
      value={formatPercent(rate)}
    >
      <AdminMetricTrendChart
        dataPoints={dataPoints}
        label="Sessions finished"
        valueFormat="percent"
      />
    </AdminAnalysisTrend>
  );
}
