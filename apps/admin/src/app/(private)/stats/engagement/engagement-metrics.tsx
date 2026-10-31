import { getAccuracyRate } from "@/data/stats/get-accuracy-rate";
import { getAccuracyRateTrend } from "@/data/stats/get-accuracy-rate-trend";
import { getActiveLearnerTrend } from "@/data/stats/get-active-learner-trend";
import { getAvgLessonTimeTrend } from "@/data/stats/get-avg-lesson-time-trend";
import { getAvgTimeByLessonKind } from "@/data/stats/get-avg-time-by-lesson-kind";
import { getCompletionRateTrend } from "@/data/stats/get-completion-rate-trend";
import { getLearningTimeTrend } from "@/data/stats/get-learning-time-trend";
import { getPeriodActiveLearners } from "@/data/stats/get-period-active-learners";
import { getPeriodAvgLessonTime } from "@/data/stats/get-period-avg-lesson-time";
import { getPeriodCompletionRate } from "@/data/stats/get-period-completion-rate";
import { getPeriodLearningTime } from "@/data/stats/get-period-learning-time";
import { formatDuration } from "@/lib/format-duration";
import { buildChartData } from "@zoonk/utils/chart";
import { AdminAnalysisTable } from "../_components/admin-analysis-table";
import { AdminAnalysisTrend } from "../_components/admin-analysis-trend";
import { AdminMetricTrendChart } from "../_components/admin-metric-trend-chart";
import { completeMetricTrend } from "../_utils/complete-metric-trend";
import { type EngagementAnalysisView } from "../_utils/stats-analysis";
import { type StatsPeriod } from "../_utils/stats-period";
import { LessonBreakdownTable } from "./lesson-breakdown-table";

export async function EngagementMetrics({
  statsPeriod,
  view,
}: {
  statsPeriod: StatsPeriod;
  view: EngagementAnalysisView;
}) {
  "use cache: private";

  if (view.id === "accuracy-rate") {
    return <AccuracyAnalysis statsPeriod={statsPeriod} />;
  }

  if (view.id === "completion-rate") {
    return <CompletionAnalysis statsPeriod={statsPeriod} />;
  }

  if (view.id === "avg-lesson-time") {
    return <AverageLessonTimeAnalysis statsPeriod={statsPeriod} />;
  }

  if (view.id === "total-learning-time") {
    return <LearningTimeAnalysis statsPeriod={statsPeriod} />;
  }

  if (view.id === "lesson-time-breakdown") {
    const breakdown = await getAvgTimeByLessonKind(
      statsPeriod.current.start,
      statsPeriod.current.end,
    );

    return (
      <AdminAnalysisTable description="Average duration, completion rate, and completed volume for each lesson type in the selected period.">
        <LessonBreakdownTable data={breakdown} />
      </AdminAnalysisTable>
    );
  }

  return <ActiveLearnerAnalysis statsPeriod={statsPeriod} />;
}

async function ActiveLearnerAnalysis({ statsPeriod }: { statsPeriod: StatsPeriod }) {
  const { chartEnd, chartPeriod, comparisonLabel, current, previous } = statsPeriod;

  const [currentValue, previousValue, trend] = await Promise.all([
    getPeriodActiveLearners(current.start, current.end),
    getPeriodActiveLearners(previous.start, previous.end),
    getActiveLearnerTrend(current.start, current.end, chartPeriod),
  ]);

  const dataPoints = completeMetricTrend({
    dataPoints: buildChartData(trend, chartPeriod, "en"),
    emptyValue: 0,
    end: chartEnd,
    period: chartPeriod,
    start: current.start,
  });

  return (
    <AdminAnalysisTrend
      comparison={{ comparisonLabel, current: currentValue, previous: previousValue }}
      description="Distinct learners who completed at least one lesson during the selected period."
      value={currentValue.toLocaleString()}
    >
      <AdminMetricTrendChart dataPoints={dataPoints} label="Active learners" valueFormat="number" />
    </AdminAnalysisTrend>
  );
}

async function AccuracyAnalysis({ statsPeriod }: { statsPeriod: StatsPeriod }) {
  const { chartEnd, chartPeriod, comparisonLabel, current, previous } = statsPeriod;

  const [currentValue, previousValue, trend] = await Promise.all([
    getAccuracyRate(current.start, current.end),
    getAccuracyRate(previous.start, previous.end),
    getAccuracyRateTrend(current.start, current.end, chartPeriod),
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
      comparison={{ comparisonLabel, current: currentValue, previous: previousValue }}
      description="Correct answers divided by all answers in the selected period."
      value={`${currentValue.toFixed(1)}%`}
    >
      <AdminMetricTrendChart dataPoints={dataPoints} label="Accuracy rate" valueFormat="percent" />
    </AdminAnalysisTrend>
  );
}

async function CompletionAnalysis({ statsPeriod }: { statsPeriod: StatsPeriod }) {
  const { chartEnd, chartPeriod, comparisonLabel, current, previous } = statsPeriod;

  const [currentValue, previousValue, trend] = await Promise.all([
    getPeriodCompletionRate(current.start, current.end),
    getPeriodCompletionRate(previous.start, previous.end),
    getCompletionRateTrend(current.start, current.end, chartPeriod),
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
      comparison={{ comparisonLabel, current: currentValue, previous: previousValue }}
      description="Completed lessons divided by lessons learners started in the selected period."
      value={`${currentValue.toFixed(1)}%`}
    >
      <AdminMetricTrendChart
        dataPoints={dataPoints}
        label="Completion rate"
        valueFormat="percent"
      />
    </AdminAnalysisTrend>
  );
}

async function AverageLessonTimeAnalysis({ statsPeriod }: { statsPeriod: StatsPeriod }) {
  const { chartEnd, chartPeriod, comparisonLabel, current, previous } = statsPeriod;

  const [currentValue, previousValue, trend] = await Promise.all([
    getPeriodAvgLessonTime(current.start, current.end),
    getPeriodAvgLessonTime(previous.start, previous.end),
    getAvgLessonTimeTrend(current.start, current.end, chartPeriod),
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
      comparison={{ comparisonLabel, current: currentValue, previous: previousValue }}
      description="Average recorded duration for lessons completed in the selected period."
      value={formatDuration(currentValue)}
    >
      <AdminMetricTrendChart
        dataPoints={dataPoints}
        label="Average time per lesson"
        valueFormat="duration"
      />
    </AdminAnalysisTrend>
  );
}

async function LearningTimeAnalysis({ statsPeriod }: { statsPeriod: StatsPeriod }) {
  const { chartEnd, chartPeriod, comparisonLabel, current, previous } = statsPeriod;

  const [currentValue, previousValue, trend] = await Promise.all([
    getPeriodLearningTime(current.start, current.end),
    getPeriodLearningTime(previous.start, previous.end),
    getLearningTimeTrend(current.start, current.end, chartPeriod),
  ]);

  const dataPoints = completeMetricTrend({
    dataPoints: buildChartData(trend, chartPeriod, "en"),
    emptyValue: 0,
    end: chartEnd,
    period: chartPeriod,
    start: current.start,
  });

  return (
    <AdminAnalysisTrend
      comparison={{ comparisonLabel, current: currentValue, previous: previousValue }}
      description="Total recorded lesson time across all learners in the selected period."
      value={formatDuration(currentValue)}
    >
      <AdminMetricTrendChart
        dataPoints={dataPoints}
        label="Total learning time"
        valueFormat="duration"
      />
    </AdminAnalysisTrend>
  );
}
