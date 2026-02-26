import { getExtracted } from "next-intl/server";
import { type ReactNode } from "react";
import { PeriodNavigation } from "./period-navigation";
import { PeriodTabs } from "./period-tabs";

export async function PerformanceChartLayout({
  children,
  hasNext,
  hasPrevious,
  isEmpty,
  periodLabel,
}: {
  children: ReactNode;
  hasNext: boolean;
  hasPrevious: boolean;
  isEmpty: boolean;
  periodLabel: string;
}) {
  const t = await getExtracted();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriodTabs />
        <PeriodNavigation hasNext={hasNext} hasPrevious={hasPrevious} periodLabel={periodLabel} />
      </div>

      {isEmpty ? (
        <div className="text-muted-foreground flex h-64 items-center justify-center rounded-xl border border-dashed">
          {t("No data available for this period")}
        </div>
      ) : (
        children
      )}
    </div>
  );
}
