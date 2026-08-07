import { countSubscribersByPlan } from "@/data/stats/count-subscribers-by-plan";
import { getActivationRate } from "@/data/stats/get-activation-rate";
import { getActivationRateTrend } from "@/data/stats/get-activation-rate-trend";
import { getConversionRate } from "@/data/stats/get-conversion-rate";
import { getConversionRateTrend } from "@/data/stats/get-conversion-rate-trend";
import { getDailySignups } from "@/data/stats/get-daily-signups";
import { getNewSignups } from "@/data/stats/get-new-signups";
import { buildChartData } from "@zoonk/utils/chart";
import { AdminAnalysisTable } from "../_components/admin-analysis-table";
import { AdminAnalysisTrend } from "../_components/admin-analysis-trend";
import { AdminMetricTrendChart } from "../_components/admin-metric-trend-chart";
import { completeMetricTrend } from "../_utils/complete-metric-trend";
import { type GrowthAnalysisView } from "../_utils/stats-analysis";
import { type StatsPeriod } from "../_utils/stats-period";
import { SubscribersTable } from "./subscribers-table";

/**
 * Loads only the selected Growth question. This preserves every existing stat
 * while avoiding the query and visual cost of rendering the other three views
 * behind the current analysis.
 */
export async function GrowthMetrics({
  statsPeriod,
  view,
}: {
  statsPeriod: StatsPeriod;
  view: GrowthAnalysisView;
}) {
  "use cache: private";

  if (view.id === "subscribers-by-plan") {
    const subscribers = await countSubscribersByPlan();

    return (
      <AdminAnalysisTable description="Current active subscriptions grouped by each learner's latest plan.">
        <SubscribersTable data={subscribers} />
      </AdminAnalysisTable>
    );
  }

  if (view.id === "activation-rate") {
    return <ActivationRateAnalysis statsPeriod={statsPeriod} />;
  }

  if (view.id === "free-to-paid") {
    return <ConversionRateAnalysis statsPeriod={statsPeriod} />;
  }

  return <SignupAnalysis statsPeriod={statsPeriod} />;
}

/**
 * Signup volume is additive, so discrete bars make empty and high-volume
 * calendar buckets easier to compare than a smoothed line.
 */
async function SignupAnalysis({ statsPeriod }: { statsPeriod: StatsPeriod }) {
  const { chartEnd, chartPeriod, comparisonLabel, current, previous } = statsPeriod;

  const [currentValue, previousValue, dailySignups] = await Promise.all([
    getNewSignups(current.start, current.end),
    getNewSignups(previous.start, previous.end),
    getDailySignups(current.start, current.end),
  ]);

  const dataPoints = completeMetricTrend({
    dataPoints: buildChartData(dailySignups, chartPeriod, "en").dataPoints,
    emptyValue: 0,
    end: chartEnd,
    period: chartPeriod,
    start: current.start,
  });

  return (
    <AdminAnalysisTrend
      comparison={{ comparisonLabel, current: currentValue, previous: previousValue }}
      description="User accounts created during the selected period."
      value={currentValue.toLocaleString()}
    >
      <AdminMetricTrendChart
        dataPoints={dataPoints}
        kind="bar"
        label="New signups"
        valueFormat="number"
      />
    </AdminAnalysisTrend>
  );
}

/**
 * Activation follows signup cohorts rather than activity dates, matching the
 * headline definition: users created in the range who completed a lesson.
 */
async function ActivationRateAnalysis({ statsPeriod }: { statsPeriod: StatsPeriod }) {
  const { chartEnd, chartPeriod, comparisonLabel, current, previous } = statsPeriod;

  const [currentValue, previousValue, trend] = await Promise.all([
    getActivationRate(current.start, current.end),
    getActivationRate(previous.start, previous.end),
    getActivationRateTrend(current.start, current.end, chartPeriod),
  ]);

  const dataPoints = completeMetricTrend({
    dataPoints: buildChartData(trend, chartPeriod, "en").dataPoints,
    emptyValue: null,
    end: chartEnd,
    period: chartPeriod,
    start: current.start,
  });

  return (
    <AdminAnalysisTrend
      comparison={{ comparisonLabel, current: currentValue.rate, previous: previousValue.rate }}
      description={`${currentValue.activated.toLocaleString()} of ${currentValue.total.toLocaleString()} signups completed at least one lesson.`}
      value={`${currentValue.rate.toFixed(1)}%`}
    >
      <AdminMetricTrendChart
        dataPoints={dataPoints}
        kind="line"
        label="Activation rate"
        valueFormat="percent"
      />
    </AdminAnalysisTrend>
  );
}

/**
 * Free-to-paid compares signup cohorts with their current subscription state,
 * so chart buckets and the period headline use the same denominator.
 */
async function ConversionRateAnalysis({ statsPeriod }: { statsPeriod: StatsPeriod }) {
  const { chartEnd, chartPeriod, comparisonLabel, current, previous } = statsPeriod;

  const [currentValue, previousValue, trend] = await Promise.all([
    getConversionRate(current.start, current.end),
    getConversionRate(previous.start, previous.end),
    getConversionRateTrend(current.start, current.end, chartPeriod),
  ]);

  const dataPoints = completeMetricTrend({
    dataPoints: buildChartData(trend, chartPeriod, "en").dataPoints,
    emptyValue: null,
    end: chartEnd,
    period: chartPeriod,
    start: current.start,
  });

  return (
    <AdminAnalysisTrend
      comparison={{ comparisonLabel, current: currentValue.rate, previous: previousValue.rate }}
      description={`${currentValue.paid.toLocaleString()} paid learners from ${currentValue.total.toLocaleString()} signups in the selected cohort.`}
      value={`${currentValue.rate.toFixed(1)}%`}
    >
      <AdminMetricTrendChart
        dataPoints={dataPoints}
        kind="line"
        label="Free-to-paid conversion"
        valueFormat="percent"
      />
    </AdminAnalysisTrend>
  );
}
