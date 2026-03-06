"use client";

import { type DailyContentRow } from "@/data/stats/get-daily-content-created";
import { Button } from "@zoonk/ui/components/button";
import { buildChartData } from "@zoonk/utils/chart";
import { type HistoryPeriod } from "@zoonk/utils/date-ranges";
import { useMemo, useState } from "react";
import { AdminTrendChart } from "../_components/admin-trend-chart";

type ContentFilterValue = "all" | "courses" | "chapters" | "lessons" | "activities" | "steps";

const filters: { label: string; value: ContentFilterValue }[] = [
  { label: "All", value: "all" },
  { label: "Courses", value: "courses" },
  { label: "Chapters", value: "chapters" },
  { label: "Lessons", value: "lessons" },
  { label: "Activities", value: "activities" },
  { label: "Steps", value: "steps" },
];

function getCountForFilter(row: DailyContentRow, filter: ContentFilterValue): number {
  if (filter === "all") {
    return row.courses + row.chapters + row.lessons + row.activities + row.steps;
  }
  return row[filter];
}

export function ContentChart({
  dailyContent,
  period,
}: {
  dailyContent: DailyContentRow[];
  period: HistoryPeriod;
}) {
  const [filter, setFilter] = useState<ContentFilterValue>("all");

  const { average, dataPoints } = useMemo(() => {
    const filtered = dailyContent.map((row) => ({
      count: getCountForFilter(row, filter),
      date: row.date,
    }));
    return buildChartData(filtered, period, "en");
  }, [dailyContent, filter, period]);

  return (
    <div className="flex flex-col gap-3">
      <nav aria-label="Content type filter" className="flex flex-wrap gap-1">
        {filters.map((item) => (
          <Button
            key={item.value}
            onClick={() => setFilter(item.value)}
            size="sm"
            variant={filter === item.value ? "default" : "outline"}
          >
            {item.label}
          </Button>
        ))}
      </nav>

      {dataPoints.length > 0 && (
        <AdminTrendChart
          average={average}
          dataPoints={dataPoints}
          valueLabel="items"
          variant="bar"
        />
      )}
    </div>
  );
}
