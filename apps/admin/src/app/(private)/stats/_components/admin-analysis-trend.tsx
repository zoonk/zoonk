import { cn } from "@zoonk/ui/lib/utils";
import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";

/**
 * Period-level change is calculated independently from the chart endpoint so
 * the large headline remains an honest aggregate instead of masquerading as
 * the final daily point.
 */
function AnalysisChange({
  comparisonLabel,
  current,
  previous,
}: {
  comparisonLabel: string;
  current: number;
  previous: number;
}) {
  if (previous === 0 || !comparisonLabel) {
    return null;
  }

  const percentageChange = ((current - previous) / previous) * 100;
  const isPositive = percentageChange >= 0;

  const formattedChange = new Intl.NumberFormat("en", {
    maximumFractionDigits: 1,
    signDisplay: "always",
    trailingZeroDisplay: "stripIfInteger",
  }).format(percentageChange);

  const Icon = isPositive ? TrendingUpIcon : TrendingDownIcon;

  return (
    <div
      className={cn(
        "flex items-center gap-1 text-sm tabular-nums",
        isPositive ? "text-success" : "text-destructive",
      )}
    >
      <Icon aria-hidden className="size-4" />
      <span>
        {formattedChange}% {comparisonLabel}
      </span>
    </div>
  );
}

/**
 * Gives the selected analysis one clear hierarchy: aggregate answer first,
 * short methodology second, and the trend across the remaining canvas.
 */
export function AdminAnalysisTrend({
  children,
  comparison,
  description,
  value,
}: {
  children: React.ReactNode;
  comparison?: { comparisonLabel: string; current: number; previous: number };
  description: string;
  value: string;
}) {
  return (
    <section className="flex min-h-136 flex-1 flex-col gap-8 py-4 sm:gap-10">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
          <p className="text-5xl leading-none font-semibold tracking-tight tabular-nums sm:text-6xl">
            {value}
          </p>
          {comparison ? <AnalysisChange {...comparison} /> : null}
        </div>
        <p className="text-muted-foreground max-w-2xl text-sm">{description}</p>
      </header>

      {children}
    </section>
  );
}
