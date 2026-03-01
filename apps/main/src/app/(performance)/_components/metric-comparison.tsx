import { cn } from "@zoonk/ui/lib/utils";
import { type HistoryPeriod } from "@zoonk/utils/date-ranges";
import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { getExtracted, getLocale } from "next-intl/server";

export async function MetricComparison({
  current,
  period,
  previous,
}: {
  current: number;
  period: HistoryPeriod;
  previous: number;
}) {
  const t = await getExtracted();
  const locale = await getLocale();

  if (previous === 0) {
    return null;
  }

  const percentageChange = ((current - previous) / previous) * 100;
  const isPositive = percentageChange >= 0;

  const formattedChange = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    signDisplay: "always",
    trailingZeroDisplay: "stripIfInteger",
  }).format(percentageChange);

  const Icon = isPositive ? TrendingUpIcon : TrendingDownIcon;

  function getComparisonLabel() {
    if (period === "month") {
      return t("vs last month");
    }

    if (period === "6months") {
      return t("vs last 6 months");
    }

    return t("vs last year");
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1 text-sm tabular-nums",
        isPositive ? "text-success" : "text-destructive",
      )}
    >
      <Icon aria-hidden className="size-4 shrink-0" />
      <span className="whitespace-nowrap">
        <span>{t("{value}%", { value: formattedChange })}</span>
        <span className="hidden sm:inline"> {getComparisonLabel()}</span>
      </span>
    </div>
  );
}
