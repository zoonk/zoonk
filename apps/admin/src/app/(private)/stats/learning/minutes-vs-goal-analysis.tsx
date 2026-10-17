import { getDailyGoalTrend } from "@/data/stats/get-daily-goal-trend";
import { formatPercent } from "@/lib/format";
import { AdminAnalysisTrend } from "../_components/admin-analysis-trend";
import { AdminMetricTrendChart } from "../_components/admin-metric-trend-chart";
import { buildMetricTrend, sumRows, toPercent, toRatePoints } from "../_utils/metric-trend";
import { type StatsPeriod } from "../_utils/stats-period";

const SECONDS_PER_MINUTE = 60;

function formatMinutes(seconds: number): string {
  return `${Math.round(seconds / SECONDS_PER_MINUTE).toLocaleString()} min`;
}

/**
 * The share of study days that reached the learner's daily minutes, with the average day's minutes
 * against its goal for scale.
 */
export async function MinutesVsGoalAnalysis({ statsPeriod }: { statsPeriod: StatsPeriod }) {
  const { chartPeriod, comparisonLabel, current, previous } = statsPeriod;

  const [currentRows, previousRows] = await Promise.all([
    getDailyGoalTrend(current.start, current.end, chartPeriod),
    getDailyGoalTrend(previous.start, previous.end, chartPeriod),
  ]);

  const days = sumRows({ rows: currentRows, value: (row) => row.days });

  const met = toPercent({
    denominator: days,
    numerator: sumRows({ rows: currentRows, value: (row) => row.met }),
  });

  const previousMet = toPercent({
    denominator: sumRows({ rows: previousRows, value: (row) => row.days }),
    numerator: sumRows({ rows: previousRows, value: (row) => row.met }),
  });

  const studied = sumRows({ rows: currentRows, value: (row) => row.studiedSeconds });
  const goal = sumRows({ rows: currentRows, value: (row) => row.goalSeconds });

  const dataPoints = buildMetricTrend({
    emptyValue: null,
    points: toRatePoints({
      denominator: (row) => row.days,
      numerator: (row) => row.met,
      rows: currentRows,
    }),
    statsPeriod,
  });

  const averageDay =
    days > 0
      ? ` The average day had ${formatMinutes(studied / days)} against a ${formatMinutes(goal / days)} goal.`
      : "";

  return (
    <AdminAnalysisTrend
      comparison={{ comparisonLabel, current: met ?? 0, previous: previousMet ?? 0 }}
      description={`Share of ${days.toLocaleString()} study days, counted from each learner's first goal, that reached the daily minutes of their active goals.${averageDay} Goals keep no history, so every day uses today's minutes.`}
      value={formatPercent(met)}
    >
      <AdminMetricTrendChart dataPoints={dataPoints} label="Daily goal met" valueFormat="percent" />
    </AdminAnalysisTrend>
  );
}
