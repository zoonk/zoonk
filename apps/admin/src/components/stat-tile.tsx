import { BigQuantity } from "@zoonk/ui/components/big-quantity";
import {
  Stat,
  StatDetail,
  StatIcon,
  StatLabel,
  StatSkeleton,
  StatValue,
} from "@zoonk/ui/components/stat";
import { cn } from "@zoonk/ui/lib/utils";
import { MinusIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { type Route } from "next";
import Link from "next/link";
import { Sparkline } from "./sparkline";
import { StatsTitle } from "./stats-title";

/** A row of numbers: two across on a phone, four across from a laptop, 8 px apart. */
export const STAT_TILES_CLASS = "grid grid-cols-2 gap-2 lg:grid-cols-4";

/**
 * A tile's name and its number are two rows of the row of tiles, so a name that wraps moves the
 * numbers of its whole row down together, and a row whose names fit holds no blank line.
 */
export const STAT_TILE_ROWS_CLASS = "row-span-2 grid grid-rows-subgrid";

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
  /**
   * `points` compares two percentages by their difference ("3 pts"): a share's own percent change
   * reads as a different, larger number.
   */
  by?: "percent" | "points";
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

function formatChangeAmount({ by = "percent", current, previous }: StatChange): string | null {
  const difference = Math.abs(current - previous);

  if (by === "points") {
    const points = difference.toLocaleString("en", { maximumFractionDigits: 1 });
    return `${points} ${points === "1" ? "pt" : "pts"}`;
  }

  return previous > 0
    ? `${Math.round((difference / previous) * PERCENT).toLocaleString("en")}%`
    : null;
}

/** How far a number moved and which way, colored by what the move means. */
export function StatChangeAmount({ change }: { change: StatChange }) {
  const { current, previous } = change;

  if (current === previous) {
    return (
      <span className="text-muted-foreground flex items-center gap-1">
        <MinusIcon aria-hidden="true" className="size-3" />
        Same
      </span>
    );
  }

  const isUp = current > previous;
  const Icon = isUp ? TrendingUpIcon : TrendingDownIcon;
  const direction = isUp ? "Up" : "Down";
  const amount = formatChangeAmount(change);

  return (
    <span className={cn("flex items-center gap-1 font-medium", changeTone(change))}>
      <Icon aria-hidden="true" className="size-3" />
      {amount === null ? (
        direction
      ) : (
        <>
          <span className="sr-only">{direction}</span>
          {amount}
        </>
      )}
    </span>
  );
}

function StatChangeLine({ change }: { change: StatChange }) {
  return (
    <StatDetail className="flex items-center gap-1">
      <StatChangeAmount change={change} />
      <span className="truncate">
        {change.current === change.previous
          ? "as before"
          : `from ${change.format(change.previous)}`}
      </span>
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
  plainValue = false,
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
  plainValue?: boolean;
  title: string;
  tone?: StatTone;
  trend?: StatTrend;
  value: string;
}) {
  const content = (
    <>
      <StatLabel className="items-start">
        {icon ? <StatIcon className={ICON_TONE[tone]}>{icon}</StatIcon> : null}
        <StatsTitle help={help} title={title} />
      </StatLabel>
      <span className="flex min-w-0 flex-col gap-1.5">
        <StatValue className={cn(tone === "brain" && "text-brain-text")}>
          {plainValue ? (
            <span className="text-readout">{value}</span>
          ) : (
            <BigQuantity>{value}</BigQuantity>
          )}
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
      </span>
    </>
  );

  if (href) {
    return (
      <Stat
        className={cn(STAT_TILE_ROWS_CLASS, "hover:bg-muted/50 transition-colors")}
        render={<Link href={href} prefetch />}
      >
        {content}
      </Stat>
    );
  }

  return <Stat className={STAT_TILE_ROWS_CLASS}>{content}</Stat>;
}

export function StatTileSkeleton({ trend = false }: { trend?: boolean }) {
  return (
    <StatSkeleton detailLines={1}>{trend ? <span className="block h-9" /> : null}</StatSkeleton>
  );
}
