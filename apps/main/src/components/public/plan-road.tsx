import { KindDot } from "@zoonk/learn/kind-tile";
import {
  AXIS_CLASS,
  AXIS_TEXT_CLASS,
  AxisLabel,
  BAND_CLASS,
  BAND_COLUMN_CLASS,
  BAND_NAME_CLASS,
  BAND_ROWS_CLASS,
  getBandColumnsStyle,
} from "@zoonk/learn/roadmap-styles";
import { cn } from "@zoonk/ui/lib/utils";
import { FlagIcon } from "lucide-react";

const PERCENT = 100;

type RoadBandState = "free" | "plus";

export type RoadBand = {
  id: string;
  name: string;
  state: RoadBandState;
  weight: number;
  todayShare?: number;
  mocks?: readonly number[];
};

/** One look per state, so the chart, its phone bar and its legend can't drift apart. */
export const ROAD_LOOK: Record<RoadBandState, string> = {
  free: "bg-surface-3 text-foreground ring-input ring-1 ring-inset",
  plus: "text-faint ring-border bg-[repeating-linear-gradient(135deg,transparent_0_3px,color-mix(in_oklab,var(--faint)_32%,transparent)_3px_4px)] ring-1 ring-inset",
};

const FULL_FROM = {
  lg: { compact: "lg:hidden", full: "lg:grid" },
  md: { compact: "md:hidden", full: "md:grid" },
  xl: { compact: "xl:hidden", full: "xl:grid" },
} as const;

function TodayTicks({ share }: { share: number }) {
  const style = { left: `${share * PERCENT}%` };

  return (
    <>
      <span className="bg-foreground absolute -top-1.5 h-1.5 w-[1.5px]" style={style} />
      <span className="bg-foreground absolute top-full h-1.5 w-[1.5px]" style={style} />
    </>
  );
}

function RoadBandFace({ band }: { band: RoadBand }) {
  return (
    <span className={cn(BAND_CLASS, ROAD_LOOK[band.state])}>
      <span className={BAND_NAME_CLASS}>{band.name}</span>
      {band.todayShare !== undefined && <TodayTicks share={band.todayShare} />}
    </span>
  );
}

function RoadLane({ band, isLast }: { band: RoadBand; isLast: boolean }) {
  return (
    <span className="relative mt-2 block h-4">
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
    <span className={AXIS_CLASS}>
      {band.todayShare !== undefined && (
        <AxisLabel share={band.todayShare}>
          <span className={cn(AXIS_TEXT_CLASS, "text-foreground")}>{todayLabel}</span>
        </AxisLabel>
      )}

      {isLast && (
        <AxisLabel after={band.todayShare !== undefined} share={1}>
          <span className={cn(AXIS_TEXT_CLASS, "text-foreground")}>{end}</span>
        </AxisLabel>
      )}
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
        <span className="flex h-2.5 gap-0.5">
          {bands.map((band) => (
            <span
              className={cn("rounded-meter min-w-6", ROAD_LOOK[band.state])}
              key={band.id}
              style={{ flexGrow: band.weight }}
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

      <ol
        aria-hidden="true"
        className={cn(
          BAND_ROWS_CLASS,
          "hidden grid-rows-[repeat(3,auto)]",
          FULL_FROM[fullFrom].full,
        )}
        style={getBandColumnsStyle(bands.map((band) => band.weight))}
      >
        {bands.map((band, index) => {
          const isLast = index === bands.length - 1;

          return (
            <li className={BAND_COLUMN_CLASS} key={band.id}>
              <RoadBandFace band={band} />
              <RoadLane band={band} isLast={isLast} />
              <RoadAxis band={band} end={end} isLast={isLast} todayLabel={todayLabel} />
            </li>
          );
        })}
      </ol>
    </div>
  );
}
