"use client";

import { Button } from "@zoonk/ui/components/button";
import { type HistoryPeriod } from "@zoonk/utils/date-ranges";
import { useQueryState } from "nuqs";

const periods: { label: string; value: HistoryPeriod }[] = [
  { label: "Month", value: "month" },
  { label: "6 Months", value: "6months" },
  { label: "Year", value: "year" },
];

export function AdminPeriodTabs() {
  const [period, setPeriod] = useQueryState("period", {
    defaultValue: "month",
    shallow: false,
  });

  return (
    <nav aria-label="Period selection" className="flex gap-1">
      {periods.map((item) => (
        <Button
          key={item.value}
          onClick={() => void setPeriod(item.value)}
          size="sm"
          variant={period === item.value ? "default" : "outline"}
        >
          {item.label}
        </Button>
      ))}
    </nav>
  );
}
