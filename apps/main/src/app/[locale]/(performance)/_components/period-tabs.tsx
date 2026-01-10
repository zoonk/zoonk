"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { useQueryState } from "nuqs";
import type { EnergyPeriod } from "@/data/progress/get-energy-history";

export function PeriodTabs() {
  const t = useExtracted();
  const [period, setPeriod] = useQueryState("period", {
    defaultValue: "month",
    shallow: false,
  });

  function handlePeriodChange(newPeriod: EnergyPeriod) {
    void setPeriod(newPeriod);
  }

  return (
    <nav aria-label={t("Period selection")} className="flex gap-1">
      <button
        className={buttonVariants({
          size: "sm",
          variant: period === "month" ? "default" : "outline",
        })}
        onClick={() => handlePeriodChange("month")}
        type="button"
      >
        {t("Month")}
      </button>

      <button
        className={buttonVariants({
          size: "sm",
          variant: period === "6months" ? "default" : "outline",
        })}
        onClick={() => handlePeriodChange("6months")}
        type="button"
      >
        {t("6 Months")}
      </button>

      <button
        className={buttonVariants({
          size: "sm",
          variant: period === "year" ? "default" : "outline",
        })}
        onClick={() => handlePeriodChange("year")}
        type="button"
      >
        {t("Year")}
      </button>
    </nav>
  );
}
