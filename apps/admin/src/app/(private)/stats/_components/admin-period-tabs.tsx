"use client";

import { Button } from "@zoonk/ui/components/button";
import { type HistoryPeriod } from "@zoonk/utils/date-ranges";
import { useQueryState } from "nuqs";

const periods: { label: string; value: HistoryPeriod }[] = [
  { label: "Month", value: "month" },
  { label: "6 Months", value: "6months" },
  { label: "Year", value: "year" },
  { label: "All", value: "all" },
];

export function AdminPeriodTabs() {
  const [period, setPeriod] = useQueryState("period", {
    defaultValue: "month",
    shallow: false,
  });

  const [, setOffset] = useQueryState("offset", { shallow: false });

  function handlePeriodChange(newPeriod: HistoryPeriod) {
    void setOffset(null);
    void setPeriod(newPeriod);
  }

  return (
    <nav aria-label="Period selection" className="flex gap-1">
      {periods.map((item) => (
        <Button
          key={item.value}
          onClick={() => handlePeriodChange(item.value)}
          size="sm"
          variant={period === item.value ? "default" : "outline"}
        >
          {item.label}
        </Button>
      ))}
    </nav>
  );
}
