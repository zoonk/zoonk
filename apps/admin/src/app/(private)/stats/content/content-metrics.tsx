import { type ContentCounts, sumContentCounts } from "@/data/stats/_utils/content-created";
import { countLibraryContent } from "@/data/stats/count-library-content";
import { getDailyContentCreated } from "@/data/stats/get-daily-content-created";
import { buildChartData } from "@zoonk/utils/chart";
import { AdminAnalysisTable } from "../_components/admin-analysis-table";
import { AdminAnalysisTrend } from "../_components/admin-analysis-trend";
import { AdminMetricTrendChart } from "../_components/admin-metric-trend-chart";
import { completeMetricTrend } from "../_utils/complete-metric-trend";
import { type ContentAnalysisView } from "../_utils/stats-analysis";
import { type StatsPeriod } from "../_utils/stats-period";
import { ContentChart } from "./content-chart-filter";
import { getContentTotalRows } from "./content-total-rows";
import { ContentTotalsTable } from "./content-totals-table";

type ContentMetric = "courses" | "items" | "lessons" | "media" | "skills";

const METRIC_BY_VIEW = {
  "new-courses": "courses",
  "new-items": "items",
  "new-lessons": "lessons",
  "new-media": "media",
  "new-skills": "skills",
} as const satisfies Record<string, ContentMetric>;

const METRIC_DESCRIPTIONS: Record<Exclude<ContentMetric, "media">, string> = {
  courses: "Courses with a Library outline, by the date the course was created.",
  items: "Practice items created during the selected period.",
  lessons: "Library lessons with generated content, by the date their outline was created.",
  skills: "Skills created during the selected period, not counting duplicates merged away.",
};

function getMetricDescription({
  created,
  metric,
}: {
  created: ContentCounts;
  metric: ContentMetric;
}): string {
  if (metric === "media") {
    return `${created.images.toLocaleString()} images and ${created.audio.toLocaleString()} audio files created during the selected period.`;
  }

  return METRIC_DESCRIPTIONS[metric];
}

/**
 * Loads one Content question at a time: a trend of one content type, the creation trend across
 * types, or the inventory.
 */
export async function ContentMetrics({
  statsPeriod,
  view,
}: {
  statsPeriod: StatsPeriod;
  view: ContentAnalysisView;
}) {
  "use cache: private";

  if (view.id === "content-totals") {
    return <ContentTotalsAnalysis statsPeriod={statsPeriod} />;
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

  return <ContentMetricAnalysis metric={METRIC_BY_VIEW[view.id]} statsPeriod={statsPeriod} />;
}

/** Inventory and period creations count the same Library rows, so both columns agree. */
async function ContentTotalsAnalysis({ statsPeriod }: { statsPeriod: StatsPeriod }) {
  const { current } = statsPeriod;

  const [dailyContent, totals] = await Promise.all([
    getDailyContentCreated(current.start, current.end),
    countLibraryContent(),
  ]);

  const rows = getContentTotalRows({ created: sumContentCounts(dailyContent), totals });

  return (
    <AdminAnalysisTable description="Current content inventory alongside content created during the selected period.">
      <ContentTotalsTable rows={rows} />
    </AdminAnalysisTable>
  );
}

function getMetricCount({
  counts,
  metric,
}: {
  counts: ContentCounts;
  metric: ContentMetric;
}): number {
  return metric === "media" ? counts.images + counts.audio : counts[metric];
}

/**
 * New courses, lessons, skills, items and media share one trend shape but keep separate entries
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

  const [currentContent, previousContent] = await Promise.all([
    getDailyContentCreated(current.start, current.end),
    getDailyContentCreated(previous.start, previous.end),
  ]);

  const created = sumContentCounts(currentContent);
  const currentValue = getMetricCount({ counts: created, metric });

  const dataPoints = completeMetricTrend({
    dataPoints: buildChartData(
      currentContent.map((row) => ({
        count: getMetricCount({ counts: row, metric }),
        date: row.date,
      })),
      chartPeriod,
      "en",
    ),
    emptyValue: 0,
    end: chartEnd,
    period: chartPeriod,
    start: current.start,
  });

  return (
    <AdminAnalysisTrend
      comparison={{
        comparisonLabel,
        current: currentValue,
        previous: getMetricCount({ counts: sumContentCounts(previousContent), metric }),
      }}
      description={getMetricDescription({ created, metric })}
      value={currentValue.toLocaleString()}
    >
      <AdminMetricTrendChart dataPoints={dataPoints} label={`New ${metric}`} valueFormat="number" />
    </AdminAnalysisTrend>
  );
}
