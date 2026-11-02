import { cn } from "@zoonk/ui/lib/utils";
import { MinusIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react";

/** An equal result is neither success nor failure, so it stays neutral instead of a green arrow. */
function getAnalysisChangeAppearance(percentageChange: number) {
  if (percentageChange > 0) {
    return { Icon: TrendingUpIcon, className: "text-success-text" };
  }

  if (percentageChange < 0) {
    return { Icon: TrendingDownIcon, className: "text-destructive-text" };
  }

  return { Icon: MinusIcon, className: "text-muted-foreground" };
}

/** Computed apart from the chart, so the headline is the period's aggregate, not its last bucket. */
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
  const { className, Icon } = getAnalysisChangeAppearance(percentageChange);

  const formattedChange = new Intl.NumberFormat("en", {
    maximumFractionDigits: 1,
    signDisplay: percentageChange === 0 ? "never" : "always",
    trailingZeroDisplay: "stripIfInteger",
  }).format(percentageChange);

  return (
    <div className={cn("flex items-center gap-1 text-sm tabular-nums", className)}>
      <Icon aria-hidden className="size-4" />
      <span>
        {formattedChange}% {comparisonLabel}
      </span>
    </div>
  );
}

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
