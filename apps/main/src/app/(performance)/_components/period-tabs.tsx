"use client";

import { type EnergyPeriod } from "@/data/progress/get-energy-history";
import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { useQueryState } from "nuqs";

export function PeriodTabs() {
  const t = useExtracted();

  const [period, setPeriod] = useQueryState("period", {
    defaultValue: "month",
    shallow: false,
  });

  const [, setOffset] = useQueryState("offset", { shallow: false });

  function handlePeriodChange(newPeriod: EnergyPeriod) {
    void setOffset(null);
    void setPeriod(newPeriod);
  }

  return (
    <nav aria-label={t("Period selection")} className="flex gap-1">
      <Button
        onClick={() => handlePeriodChange("month")}
        size="sm"
        variant={period === "month" ? "default" : "outline"}
      >
        {t("Month")}
      </Button>

      <Button
        onClick={() => handlePeriodChange("6months")}
        size="sm"
        variant={period === "6months" ? "default" : "outline"}
      >
        {t("6 Months")}
      </Button>

      <Button
        onClick={() => handlePeriodChange("year")}
        size="sm"
        variant={period === "year" ? "default" : "outline"}
      >
        {t("Year")}
      </Button>
    </nav>
  );
}
