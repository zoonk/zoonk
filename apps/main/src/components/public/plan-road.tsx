import { DaySegment, type DaySegmentState } from "@zoonk/learn/day-segments";
import { KindDot } from "@zoonk/learn/kind-tile";
import { METER_PARTS_CLASS } from "@zoonk/learn/meter";
import { AXIS_LABEL_CLASS, BAND_CLASS, BAND_STATE_CLASS } from "@zoonk/learn/roadmap-styles";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, FlagIcon } from "lucide-react";

const PERCENT = 100;

/** A label reads leftward from its line past the middle of its band, so it stays inside. */
const MIDDLE_SHARE = 0.5;

type RoadBandState = "current" | "done" | "plus" | "upcoming";

export type RoadBand = {
  id: string;
  name: string;
  state: RoadBandState;
  weight: number;
  startLabel?: string;
  todayShare?: number;
  share?: number;
  mocks?: readonly number[];
};

const BAND_LOOK: Record<RoadBandState, string> = {
  current: BAND_STATE_CLASS.current,
  done: BAND_STATE_CLASS.done,
  plus: "text-faint ring-border bg-[repeating-linear-gradient(135deg,transparent_0_6px,color-mix(in_oklab,var(--faint)_18%,transparent)_6px_7px)] ring-1 ring-inset",
  upcoming: BAND_STATE_CLASS.upcoming,
};

const SEGMENT_STATE: Record<RoadBandState, DaySegmentState> = {
  current: "current",
  done: "done",
  plus: "ahead",
  upcoming: "ahead",
};

const FULL_FROM = {
  lg: { compact: "lg:hidden", full: "lg:flex" },
  md: { compact: "md:hidden", full: "md:flex" },
  xl: { compact: "xl:hidden", full: "xl:flex" },
} as const;

function getLabelStyle(share: number): React.CSSProperties {
  return share < MIDDLE_SHARE
    ? { left: `${share * PERCENT}%` }
    : { right: `${(1 - share) * PERCENT}%` };
}

function TodayTicks({ share }: { share: number }) {
  const style = { left: `${share * PERCENT}%` };

  return (
    <>
      <span className="bg-foreground absolute -top-1.5 h-1.5 w-[1.5px]" style={style} />
      <span className="bg-foreground absolute top-8 h-1.5 w-[1.5px]" style={style} />
    </>
  );
}

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

/** A label that wouldn't fit beside its neighbors is left out, as the Plan does. */
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

/** A picture: screen readers hear `caption` instead. */
export function PlanRoad({
  bands,
  caption,
  className,
  end,
  fullFrom = "lg",
  todayLabel,
}: {
  bands: readonly RoadBand[];
  caption: string;
  className?: string;
  end: string;
  fullFrom?: keyof typeof FULL_FROM;
  todayLabel: string;
}) {
  return (
    <div className={cn("min-w-0", className)} data-slot="plan-road">
      <p className="sr-only">{caption}</p>

      <div aria-hidden="true" className={cn("flex flex-col gap-2", FULL_FROM[fullFrom].compact)}>
        <span className={METER_PARTS_CLASS}>
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
