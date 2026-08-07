import { countContent } from "@/data/stats/count-content";
import {
  type DailyContentRow,
  getDailyContentCreated,
} from "@/data/stats/get-daily-content-created";
import { getPeriodContentCreated } from "@/data/stats/get-period-content-created";
import { buildChartData } from "@zoonk/utils/chart";
import { AdminAnalysisTable } from "../_components/admin-analysis-table";
import { AdminAnalysisTrend } from "../_components/admin-analysis-trend";
import { AdminMetricTrendChart } from "../_components/admin-metric-trend-chart";
import { completeMetricTrend } from "../_utils/complete-metric-trend";
import { type ContentAnalysisView } from "../_utils/stats-analysis";
import { type StatsPeriod } from "../_utils/stats-period";
import { CompletedLessonsByKindTable } from "./completed-lessons-by-kind-table";
import { ContentChart } from "./content-chart-filter";
import { ContentTotalsTable } from "./content-totals-table";

type ContentMetric = "courses" | "lessons";

/**
 * Loads one Content question at a time while preserving the existing trend,
 * period totals, all-time totals, and completed-lesson kind breakdown.
 */
export async function ContentMetrics({
  statsPeriod,
  view,
}: {
  statsPeriod: StatsPeriod;
  view: ContentAnalysisView;
}) {
  "use cache: private";

  if (view.id === "completed-lessons-by-kind") {
    const totals = await countContent();

    return (
      <AdminAnalysisTable description="All completed-generation lessons grouped by their learning format.">
        <CompletedLessonsByKindTable lessonsByKind={totals.completedLessonsByKind} />
      </AdminAnalysisTable>
    );
  }

  if (view.id === "content-totals") {
    const [currentCreated, totals] = await Promise.all([
      getPeriodContentCreated(statsPeriod.current.start, statsPeriod.current.end),
      countContent(),
    ]);

    return (
      <AdminAnalysisTable description="Current content inventory alongside completed content created during the selected period.">
        <ContentTotalsTable periodCreated={currentCreated} totals={totals} />
      </AdminAnalysisTable>
    );
  }

  if (view.id === "content-creation") {
    const [currentContent, previousContent] = await Promise.all([
      getDailyContentCreated(statsPeriod.current.start, statsPeriod.current.end),
      getDailyContentCreated(statsPeriod.previous.start, statsPeriod.previous.end),
    ]);

    return (
      <ContentChart
        currentContent={currentContent}
        previousContent={previousContent}
        statsPeriod={statsPeriod}
      />
    );
  }

  return (
    <ContentMetricAnalysis
      metric={view.id === "new-lessons" ? "lessons" : "courses"}
      statsPeriod={statsPeriod}
    />
  );
}

/**
 * New courses and new lessons share one trend shape but keep separate entries
 * in the analysis picker because they answer distinct operational questions.
 */
async function ContentMetricAnalysis({
  metric,
  statsPeriod,
}: {
  metric: ContentMetric;
  statsPeriod: StatsPeriod;
}) {
  const { chartEnd, chartPeriod, comparisonLabel, current, previous } = statsPeriod;

  const [currentCreated, previousCreated, dailyContent] = await Promise.all([
    getPeriodContentCreated(current.start, current.end),
    getPeriodContentCreated(previous.start, previous.end),
    getDailyContentCreated(current.start, current.end),
  ]);

  const rawTrend = getContentMetricTrend({ dailyContent, metric });

  const dataPoints = completeMetricTrend({
    dataPoints: buildChartData(rawTrend, chartPeriod, "en"),
    emptyValue: 0,
    end: chartEnd,
    period: chartPeriod,
    start: current.start,
  });

  const title = metric === "courses" ? "courses" : "completed-generation lessons";

  return (
    <AdminAnalysisTrend
      comparison={{
        comparisonLabel,
        current: currentCreated[metric],
        previous: previousCreated[metric],
      }}
      description={`New ${title} created during the selected period.`}
      value={currentCreated[metric].toLocaleString()}
    >
      <AdminMetricTrendChart dataPoints={dataPoints} label={`New ${metric}`} valueFormat="number" />
    </AdminAnalysisTrend>
  );
}

/**
 * Reduces the multi-type daily content rows to the one additive series needed
 * by a selected course or lesson analysis.
 */
function getContentMetricTrend({
  dailyContent,
  metric,
}: {
  dailyContent: DailyContentRow[];
  metric: ContentMetric;
}) {
  return dailyContent.map((row) => ({ count: row[metric], date: row.date }));
}
