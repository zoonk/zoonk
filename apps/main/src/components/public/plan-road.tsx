import { DAY_SEGMENTS_CLASS, DaySegment, type DaySegmentState } from "@zoonk/learn/day-segments";
import { KindDot } from "@zoonk/learn/kind-tile";
import { AXIS_LABEL_CLASS, BAND_CLASS, BAND_STATE_CLASS } from "@zoonk/learn/roadmap-styles";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, FlagIcon } from "lucide-react";

const PERCENT = 100;

/** A label reads leftward from its line past the middle of its band, so it stays inside. */
const MIDDLE_SHARE = 0.5;

/**
 * A band's state on an example road: the Plan's own (done, the current one, ahead), or `plus`,
 * what only Plus reaches, hatched, for the pricing page's free plan against Plus.
 */
type RoadBandState = "current" | "done" | "plus" | "upcoming";

export type RoadBand = {
  id: string;
  name: string;
  state: RoadBandState;
  /** How long the band is, in any unit the road's bands share (days, weeks). */
  weight: number;
  /** Under a band ahead of today: its first day ("Dec"). */
  startLabel?: string;
  /** Where today falls in the current band, 0 to 1. */
  todayShare?: number;
  /** How much of the current band's work is done, 0 to 1, as the Plan underlines it in green. */
  share?: number;
  /** The mock exams in the band, each where it falls, 0 to 1. */
  mocks?: readonly number[];
};

const BAND_LOOK: Record<RoadBandState, string> = {
  current: BAND_STATE_CLASS.current,
  done: BAND_STATE_CLASS.done,
  plus: "text-faint ring-border bg-[repeating-linear-gradient(135deg,transparent_0_6px,color-mix(in_oklab,var(--faint)_18%,transparent)_6px_7px)] ring-1 ring-inset",
  upcoming: BAND_STATE_CLASS.upcoming,
};

/** On the phone's compact bar a band is a segment, as the Plan draws its phases there. */
const SEGMENT_STATE: Record<RoadBandState, DaySegmentState> = {
  current: "current",
  done: "done",
  plus: "ahead",
  upcoming: "ahead",
};

/** Where the full road takes over from the compact bar. */
const FULL_FROM = {
  lg: { compact: "lg:hidden", full: "lg:flex" },
  md: { compact: "md:hidden", full: "md:flex" },
  xl: { compact: "xl:hidden", full: "xl:flex" },
} as const;

/** A label's place on its band's line, from the side it reads toward. */
function getLabelStyle(share: number): React.CSSProperties {
  return share < MIDDLE_SHARE
    ? { left: `${share * PERCENT}%` }
    : { right: `${(1 - share) * PERCENT}%` };
}

/** Today's place in the current band: a short line over it and under it, as the Plan marks it. */
function TodayTicks({ share }: { share: number }) {
  const style = { left: `${share * PERCENT}%` };

  return (
    <>
      <span className="bg-foreground absolute -top-1.5 h-1.5 w-[1.5px]" style={style} />
      <span className="bg-foreground absolute top-8 h-1.5 w-[1.5px]" style={style} />
    </>
  );
}

/** The band itself, its name inside (a check before a done one's), the current one underlined. */
function RoadBandFace({ band }: { band: RoadBand }) {
  return (
    <span className={cn(BAND_CLASS, BAND_LOOK[band.state])}>
      {band.state === "done" && (
        <CheckIcon aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={2.5} />
      )}

      <span className="min-w-0 truncate">{band.name}</span>

      {band.state === "current" && band.share !== undefined && band.share > 0 && (
        <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
          <span
            className="bg-success absolute bottom-0 left-0 h-0.5"
            style={{ width: `${band.share * PERCENT}%` }}
          />
        </span>
      )}
    </span>
  );
}

/** Under a band: its mock exams on their days, and the goal's flag at the end of the last one. */
function RoadLane({ band, isLast }: { band: RoadBand; isLast: boolean }) {
  return (
    <span className="relative mt-1 block h-4">
      {band.mocks?.map((share) => (
        <span
          className="absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2"
          key={share}
          style={{ left: `${share * PERCENT}%` }}
        >
          <KindDot className="size-1.5" kind="mock" />
        </span>
      ))}

      {isLast && <FlagIcon className="absolute top-0 right-0 size-3.5" />}
    </span>
  );
}

/**
 * The band's stretch of the road's one line of days: today in the current one, the first day of
 * one ahead, the goal's date at the end of the last. A label that wouldn't fit beside its
 * neighbors is left out, as the Plan does.
 */
function RoadAxis({
  band,
  end,
  isLast,
  todayLabel,
}: {
  band: RoadBand;
  end: string;
  isLast: boolean;
  todayLabel: string;
}) {
  return (
    <span className="relative block h-4">
      {band.todayShare !== undefined && (
        <span
          className={cn(AXIS_LABEL_CLASS, "text-foreground")}
          style={getLabelStyle(band.todayShare)}
        >
          {todayLabel}
        </span>
      )}

      {band.startLabel && (
        <span
          className={cn(
            AXIS_LABEL_CLASS,
            "left-0",
            isLast ? "@max-[10rem]/phase:hidden" : "@max-[4.5rem]/phase:hidden",
          )}
        >
          {band.startLabel}
        </span>
      )}

      {isLast && <span className={cn(AXIS_LABEL_CLASS, "text-foreground right-0")}>{end}</span>}
    </span>
  );
}

/**
 * A plan's road as the Plan draws it: one band per phase, as long as its days, done ones green,
 * today's line in the current one, the mock exams on their days and the goal's flag and date at
 * the end. Below `fullFrom` it's the Plan's compact bar with the road in words under it. A
 * picture: screen readers hear `caption` instead.
 */
export function PlanRoad({
  bands,
  caption,
  className,
  end,
  fullFrom = "lg",
  todayLabel,
}: {
  bands: readonly RoadBand[];
  /** The road in words ("Phase 2 of 5 · Reading and Writing"). */
  caption: string;
  className?: string;
  /** The goal's date, at the road's end. */
  end: string;
  fullFrom?: keyof typeof FULL_FROM;
  todayLabel: string;
}) {
  return (
    <div className={cn("min-w-0", className)} data-slot="plan-road">
      <p className="sr-only">{caption}</p>

      <div aria-hidden="true" className={cn("flex flex-col gap-2", FULL_FROM[fullFrom].compact)}>
        <span className={DAY_SEGMENTS_CLASS}>
          {bands.map((band) => (
            <DaySegment
              className="min-w-6"
              key={band.id}
              minutes={band.weight}
              share={band.state === "current" ? (band.share ?? 0) : 0}
              state={SEGMENT_STATE[band.state]}
            />
          ))}
        </span>

        <span className="flex items-baseline justify-between gap-3 text-xs">
          <span className="text-muted-foreground min-w-0 text-pretty">{caption}</span>
          <span className="text-foreground flex shrink-0 items-center gap-1 font-mono tabular-nums">
            <FlagIcon className="size-3" />
            {end}
          </span>
        </span>
      </div>

      <ol aria-hidden="true" className={cn("hidden gap-[3px]", FULL_FROM[fullFrom].full)}>
        {bands.map((band, index) => {
          const isLast = index === bands.length - 1;

          return (
            <li
              className="@container/phase relative flex min-w-16 basis-0 flex-col"
              key={band.id}
              style={{ flexGrow: band.weight }}
            >
              <RoadBandFace band={band} />
              {band.todayShare !== undefined && <TodayTicks share={band.todayShare} />}
              <RoadLane band={band} isLast={isLast} />
              <RoadAxis band={band} end={end} isLast={isLast} todayLabel={todayLabel} />
            </li>
          );
        })}
      </ol>
    </div>
  );
}
