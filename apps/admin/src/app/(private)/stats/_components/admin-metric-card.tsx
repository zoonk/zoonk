import { StatsTitle } from "@/components/stats-title";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { type HistoryPeriod } from "@zoonk/utils/date-ranges";
import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";

function getComparisonLabel(period: HistoryPeriod) {
  if (period === "month") {
    return "vs last month";
  }

  if (period === "6months") {
    return "vs last 6 months";
  }

  return "vs last year";
}

function ChangeIndicator({
  current,
  previous,
  period,
}: {
  current: number;
  previous: number;
  period: HistoryPeriod;
}) {
  if (previous === 0) {
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
      <Icon aria-hidden className="size-4 shrink-0" />
      <span className="whitespace-nowrap">
        {formattedChange}% {getComparisonLabel(period)}
      </span>
    </div>
  );
}

export function AdminMetricCard({
  title,
  value,
  help,
  description,
  icon,
  change,
}: {
  title: string;
  value: string | number;
  help?: string;
  description?: string;
  icon?: React.ReactNode;
  change?: { current: number; previous: number; period: HistoryPeriod };
}) {
  return (
    <div className="flex w-full flex-col gap-1.5">
      <header className="text-muted-foreground flex items-center gap-1.5">
        {icon && <span className="flex size-4 items-center justify-center">{icon}</span>}
        <StatsTitle help={help} title={title} />
      </header>

      <div className="text-foreground text-3xl font-medium tracking-tight">{value}</div>

      {description && <p className="text-muted-foreground text-sm">{description}</p>}

      {change && (
        <ChangeIndicator
          current={change.current}
          period={change.period}
          previous={change.previous}
        />
      )}
    </div>
  );
}

export function AdminMetricCardSkeleton() {
  return (
    <div className="flex w-full flex-col gap-1.5">
      <header className="flex items-center gap-1.5">
        <Skeleton className="size-4 rounded-lg" />
        <Skeleton className="h-4 w-24 rounded" />
      </header>
      <Skeleton className="h-8 w-32 rounded" />
      <Skeleton className="h-4 w-20 rounded" />
    </div>
  );
}
