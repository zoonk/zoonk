"use client";

import { type DailyContentRow } from "@/data/stats/get-daily-content-created";
import { Button } from "@zoonk/ui/components/button";
import { buildChartData } from "@zoonk/utils/chart";
import { useMemo, useState } from "react";
import { AdminAnalysisTrend } from "../_components/admin-analysis-trend";
import { AdminMetricTrendChart } from "../_components/admin-metric-trend-chart";
import { completeMetricTrend } from "../_utils/complete-metric-trend";
import { type StatsPeriod } from "../_utils/stats-period";

type ContentFilterValue = "all" | "courses" | "chapters" | "lessons" | "steps";

const FILTERS: { label: string; value: ContentFilterValue }[] = [
  { label: "All", value: "all" },
  { label: "Courses", value: "courses" },
  { label: "Chapters", value: "chapters" },
  { label: "Lessons", value: "lessons" },
  { label: "Steps", value: "steps" },
];

/**
 * Content creation can be explored as one total or one creation pipeline
 * stage, while every choice retains the same calendar buckets.
 */
function getCountForFilter({
  filter,
  row,
}: {
  filter: ContentFilterValue;
  row: DailyContentRow;
}): number {
  if (filter === "all") {
    return row.courses + row.chapters + row.lessons + row.steps;
  }

  return row[filter];
}

/**
 * The selected content-type headline is the sum of its visible buckets, which
 * keeps the filter, period total, and chart mathematically aligned.
 */
function getFilteredTotal({
  content,
  filter,
}: {
  content: DailyContentRow[];
  filter: ContentFilterValue;
}): number {
  return content.reduce((total, row) => total + getCountForFilter({ filter, row }), 0);
}

/**
 * Content creation is the one analysis with a useful second dimension. Its
 * type filter stays local to the chart instead of becoming permanent global
 * chrome or multiplying five near-identical entries in the analysis picker.
 */
export function ContentChart({
  currentContent,
  previousContent,
  statsPeriod,
}: {
  currentContent: DailyContentRow[];
  previousContent: DailyContentRow[];
  statsPeriod: StatsPeriod;
}) {
  const [filter, setFilter] = useState<ContentFilterValue>("all");

  const analysis = useMemo(() => {
    const filtered = currentContent.map((row) => ({
      count: getCountForFilter({ filter, row }),
      date: row.date,
    }));

    return {
      current: getFilteredTotal({ content: currentContent, filter }),
      dataPoints: completeMetricTrend({
        dataPoints: buildChartData(filtered, statsPeriod.chartPeriod, "en").dataPoints,
        emptyValue: 0,
        end: statsPeriod.chartEnd,
        period: statsPeriod.chartPeriod,
        start: statsPeriod.current.start,
      }),
      previous: getFilteredTotal({ content: previousContent, filter }),
    };
  }, [currentContent, filter, previousContent, statsPeriod]);

  return (
    <AdminAnalysisTrend
      comparison={{
        comparisonLabel: statsPeriod.comparisonLabel,
        current: analysis.current,
        previous: analysis.previous,
      }}
      description="Courses and completed chapters and lessons, plus steps created during the selected period."
      value={analysis.current.toLocaleString()}
    >
      <nav aria-label="Content type filter" className="flex flex-wrap gap-1">
        {FILTERS.map((item) => (
          <Button
            key={item.value}
            onClick={() => setFilter(item.value)}
            size="sm"
            variant={filter === item.value ? "default" : "ghost"}
          >
            {item.label}
          </Button>
        ))}
      </nav>

      <AdminMetricTrendChart
        dataPoints={analysis.dataPoints}
        kind="bar"
        label="Content creation"
        valueFormat="number"
      />
    </AdminAnalysisTrend>
  );
}
