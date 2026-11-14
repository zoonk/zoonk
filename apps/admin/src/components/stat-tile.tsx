import { BigQuantity } from "@zoonk/ui/components/big-quantity";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { Stat, StatDetail, StatIcon, StatLabel, StatValue } from "@zoonk/ui/components/stat";
import { cn } from "@zoonk/ui/lib/utils";
import { MinusIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { type Route } from "next";
import Link from "next/link";
import { Sparkline } from "./sparkline";
import { StatsTitle } from "./stats-title";

/** A row of numbers: two across on a phone, four across from a laptop, 8 px apart. */
export const STAT_TILES_CLASS = "grid grid-cols-2 gap-2 lg:grid-cols-4";

/**
 * The icon's color says what the number is, as in the learner apps: violet is Brain Power, amber
 * Energy, blue progress made, pink-red something that failed. Any other number's icon is neutral.
 */
const ICON_TONE = {
  brain: "text-brain",
  danger: "text-destructive",
  energy: "text-energy",
  neutral: "text-muted-foreground",
  success: "text-success",
} as const;

type StatTone = keyof typeof ICON_TONE;

export type StatChange = {
  current: number;
  /** What a fall means. Left out, it has no color. */
  fall?: ChangeMeaning;
  format: (value: number) => string;
  previous: number;
  /** What a rise means. Left out, it has no color. */
  rise?: ChangeMeaning;
};

/** Good news is blue, as progress is everywhere; `watch` is amber, something to look at. */
type ChangeMeaning = "good" | "watch";

const MEANING_CLASS: Record<ChangeMeaning, string> = {
  good: "text-success-text",
  watch: "text-warning-text",
};

const PERCENT = 100;

/** A change is colored by what it means, never by its sign: more learners is good, more spend is one to watch. */
function changeTone({ current, fall, previous, rise }: StatChange): string {
  const meaning = current > previous ? rise : fall;
  return meaning ? MEANING_CLASS[meaning] : "text-muted-foreground";
}

function StatChangeLine({ change }: { change: StatChange }) {
  const { current, format, previous } = change;

  if (current === previous) {
    return (
      <StatDetail className="flex items-center gap-1">
        <MinusIcon aria-hidden="true" className="size-3" />
        Same as before
      </StatDetail>
    );
  }

  const isUp = current > previous;
  const Icon = isUp ? TrendingUpIcon : TrendingDownIcon;
  const direction = isUp ? "Up" : "Down";

  const percent =
    previous > 0 ? Math.round((Math.abs(current - previous) / previous) * PERCENT) : null;

  return (
    <StatDetail className="flex items-center gap-1">
      <span className={cn("flex items-center gap-1 font-medium", changeTone(change))}>
        <Icon aria-hidden="true" className="size-3" />
        {percent === null ? (
          direction
        ) : (
          <>
            <span className="sr-only">{direction}</span>
            {percent.toLocaleString("en")}%
          </>
        )}
      </span>
      <span className="truncate">from {format(previous)}</span>
    </StatDetail>
  );
}

export type StatTrend = {
  /** How many leading values belong to the period before the one the number counts. */
  before?: number;
  label: string;
  values: readonly number[];
};

/**
 * One number: its icon and name, the value, how it changed or one line about it, and its recent
 * shape when it has a history. With an `href` the whole tile opens the page that explains it.
 */
export function StatTile({
  change,
  detail,
  help,
  href,
  icon,
  title,
  tone = "neutral",
  trend,
  value,
}: {
  change?: StatChange;
  detail?: React.ReactNode;
  help?: string;
  href?: Route;
  icon?: React.ReactNode;
  title: string;
  tone?: StatTone;
  trend?: StatTrend;
  value: string;
}) {
  const content = (
    <>
      <StatLabel>
        {icon ? <StatIcon className={ICON_TONE[tone]}>{icon}</StatIcon> : null}
        <StatsTitle help={help} title={title} />
      </StatLabel>
      <StatValue className={cn(tone === "brain" && "text-brain-text")}>
        <BigQuantity>{value}</BigQuantity>
      </StatValue>
      {change ? <StatChangeLine change={change} /> : null}
      {detail ? <StatDetail>{detail}</StatDetail> : null}
      {/* Its end dot stays inside the tile's padding. */}
      {trend ? (
        <Sparkline
          before={trend.before}
          className="me-0.75 mt-auto"
          label={trend.label}
          values={trend.values}
        />
      ) : null}
    </>
  );

  if (href) {
    return (
      <Stat className="hover:bg-muted/50 transition-colors" render={<Link href={href} prefetch />}>
        {content}
      </Stat>
    );
  }

  return <Stat>{content}</Stat>;
}

export function StatTileSkeleton({ trend = false }: { trend?: boolean }) {
  return (
    <Stat aria-hidden="true">
      <span className="flex h-4 items-center">
        <Skeleton className="h-3 w-24" />
      </span>
      <span className="flex h-7.25 items-center">
        <Skeleton className="h-6 w-20" />
      </span>
      <span className="flex h-4 items-center">
        <Skeleton className="h-3 w-28" />
      </span>
      {trend ? <span className="block h-9" /> : null}
    </Stat>
  );
}
