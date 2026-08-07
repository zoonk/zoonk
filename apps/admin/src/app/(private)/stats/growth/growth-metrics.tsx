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
    dataPoints: buildChartData(dailySignups, chartPeriod, "en"),
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
      <AdminMetricTrendChart dataPoints={dataPoints} label="New signups" valueFormat="number" />
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
    dataPoints: buildChartData(trend, chartPeriod, "en"),
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
        label="Activation rate"
        valueFormat="percent"
      />
    </AdminAnalysisTrend>
  );
}

/**
 * The headline shows period conversion: learners who paid at any point in the
 * selected range. The chart shows end-of-bucket subscriber share so additions
 * and churn produce the stock-style trend admins expect.
 */
async function ConversionRateAnalysis({ statsPeriod }: { statsPeriod: StatsPeriod }) {
  const { chartEnd, chartPeriod, comparisonLabel, current, previous } = statsPeriod;

  const [currentValue, previousValue, trend] = await Promise.all([
    getConversionRate(current.start, chartEnd),
    getConversionRate(previous.start, previous.end),
    getConversionRateTrend(current.start, chartEnd, chartPeriod),
  ]);

  const dataPoints = completeMetricTrend({
    dataPoints: buildChartData(trend, chartPeriod, "en"),
    emptyValue: null,
    end: chartEnd,
    period: chartPeriod,
    start: current.start,
  });

  return (
    <AdminAnalysisTrend
      comparison={{ comparisonLabel, current: currentValue.rate, previous: previousValue.rate }}
      description={`${currentValue.paid.toLocaleString()} of ${currentValue.total.toLocaleString()} learners had paid access during the selected period.`}
      value={`${currentValue.rate.toFixed(1)}%`}
    >
      <AdminMetricTrendChart
        dataPoints={dataPoints}
        label="Free-to-paid conversion"
        valueFormat="percent"
      />
    </AdminAnalysisTrend>
  );
}
