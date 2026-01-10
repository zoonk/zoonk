import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { getExtracted, getLocale } from "next-intl/server";
import type { EnergyPeriod } from "@/data/progress/get-energy-history";

type EnergyComparisonProps = {
  current: number;
  period: EnergyPeriod;
  previous: number;
};

export async function EnergyComparison({
  current,
  period,
  previous,
}: EnergyComparisonProps) {
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

  function renderComparison() {
    if (period === "month") {
      return t("{change}% vs last month", { change: formattedChange });
    }
    if (period === "6months") {
      return t("{change}% vs last 6 months", { change: formattedChange });
    }
    return t("{change}% vs last year", { change: formattedChange });
  }

  return (
    <div
      className={`flex items-center gap-1 text-sm ${
        isPositive ? "text-green-600" : "text-red-600"
      }`}
    >
      <Icon aria-hidden className="size-4" />
      <span>{renderComparison()}</span>
    </div>
  );
}
