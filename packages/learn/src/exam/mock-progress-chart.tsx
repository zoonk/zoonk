"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useState } from "react";

/** One mock on the chart: its score, and what its readout says about it. */
export type ProgressPoint = { detail: string; key: string; label: string; value: number };

const TOP = 100;

/** Below 0 (a net score), the axis steps down by this much, so its ticks stay round. */
const NEGATIVE_STEP = 50;

/** The mocks' color, one step that clears 3:1 on the card in light and in dark. */
const MOCK_MARK_CLASS = "text-orange-600";

/** The axis' lowest value: 0, or a round step below the lowest score when a net score went under. */
function getChartFloor(values: readonly number[]): number {
  const lowest = Math.min(0, ...values);
  return Math.floor(lowest / NEGATIVE_STEP) * NEGATIVE_STEP;
}

function toY({ floor, value }: { floor: number; value: number }): number {
  return ((TOP - value) / (TOP - floor)) * TOP;
}

/** Points spread evenly by order, from edge to edge; a single one is the latest, at the end. */
function toX({ count, index }: { count: number; index: number }): number {
  return count > 1 ? (index / (count - 1)) * TOP : TOP;
}

function toCoordinates({ floor, values }: { floor: number; values: readonly number[] }) {
  return values.map((value, index) => ({
    x: toX({ count: values.length, index }),
    y: toY({ floor, value }),
  }));
}

/**
 * The line through the points and the faint wash under it, drawn in a 100×100 box stretched to the
 * chart, its strokes kept at their width.
 */
function ChartLine({
  className,
  floor,
  values,
  wash = false,
}: {
  className?: string;
  floor: number;
  values: readonly number[];
  wash?: boolean;
}) {
  const coordinates = toCoordinates({ floor, values });
  const line = coordinates.map(({ x, y }) => `${x},${y}`).join(" ");
  const base = toY({ floor, value: Math.max(floor, 0) });
  const area = `M0,${base} L${line.replaceAll(" ", " L")} L${TOP},${base} Z`;

  return (
    <svg
      aria-hidden="true"
      className={cn("absolute inset-0 size-full overflow-visible", className)}
      preserveAspectRatio="none"
      viewBox="0 0 100 100"
    >
      {wash && <path className="fill-current opacity-10" d={area} />}
      <polyline
        fill="none"
        points={line}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** Where the readout sits beside its mock: clear of the chart's edges near them. */
const EDGE = 25;
const FAR_EDGE = 75;

function readoutAlign(x: number): string {
  if (x < EDGE) {
    return "-translate-x-3";
  }

  return x > FAR_EDGE ? "-translate-x-[calc(100%-0.75rem)]" : "-translate-x-1/2";
}

/**
 * The mock the pointer is nearest (by its place along the line) or the arrow keys picked: the
 * chart is one target, as wide as it is, never a row of small dots to aim at.
 */
function useActivePoint(count: number) {
  const [active, setActive] = useState<number | null>(null);
  const clamp = (index: number) => Math.min(count - 1, Math.max(0, index));

  const nearest = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return clamp(Math.round(((event.clientX - box.left) / box.width) * (count - 1)));
  };

  const keys: Record<string, (current: number) => number> = {
    ArrowLeft: (current) => current - 1,
    ArrowRight: (current) => current + 1,
    End: () => count - 1,
    Home: () => 0,
  };

  return {
    active,
    handlers: {
      onBlur: () => setActive(null),
      onFocus: () => setActive((current) => current ?? count - 1),
      onKeyDown: (event: React.KeyboardEvent) => {
        const move = keys[event.key];

        if (move) {
          event.preventDefault();
          setActive((current) => clamp(move(current ?? count - 1)));
        }
      },
      onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => setActive(nearest(event)),
      onPointerLeave: () => setActive(null),
      onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => setActive(nearest(event)),
    },
  };
}

/** The picked mock: a hairline down to it, its dot larger, and its score and name above it. */
function ActiveReadout({ point, x, y }: { point: ProgressPoint; x: number; y: number }) {
  return (
    <>
      <span
        aria-hidden="true"
        className="bg-foreground/15 pointer-events-none absolute inset-y-0 w-px"
        style={{ left: `${x}%` }}
      />
      <span
        aria-hidden="true"
        className="ring-card pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current ring-2"
        style={{ left: `${x}%`, top: `${y}%` }}
      />
      <span
        aria-hidden="true"
        className={cn(
          "bg-foreground text-background pointer-events-none absolute z-10 flex w-max max-w-56 -translate-y-[calc(100%+0.75rem)] flex-col rounded-2xl px-3 py-1.5 text-xs",
          readoutAlign(x),
        )}
        style={{ left: `${x}%`, top: `${y}%` }}
      >
        <span className="font-semibold tabular-nums">{point.label}</span>
        <span className="opacity-80">{point.detail}</span>
      </span>
    </>
  );
}

/**
 * Each mock's score over time as one line: hairline guides at the top, middle and bottom of the
 * axis, a dot per mock, and the first and latest mocks named under it. Pointing anywhere on it (or
 * the arrow keys, as a slider over the mocks) picks the nearest mock and says its score and what
 * it was. One series, so its title names it and it has no legend; the list of mocks is its table.
 */
export function ProgressLineChart({
  first,
  label,
  latest,
  points,
}: {
  /** Under the chart's left edge: the first mock. */
  first: string;
  /** What the chart shows, for screen readers. */
  label: string;
  /** Under the chart's right edge: the latest mock. */
  latest: string;
  points: readonly ProgressPoint[];
}) {
  const values = points.map((point) => point.value);
  const floor = getChartFloor(values);
  const ticks = [TOP, (TOP + floor) / 2, floor];
  const coordinates = toCoordinates({ floor, values });
  const { active, handlers } = useActivePoint(points.length);
  const picked = active === null ? null : points[active];
  const activeAt = active === null ? null : coordinates[active];

  return (
    <figure aria-label={label} className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <div
          aria-hidden="true"
          className="text-muted-foreground flex h-32 w-9 shrink-0 flex-col justify-between text-right text-[0.6875rem] leading-none tabular-nums"
        >
          {ticks.map((tick) => (
            <span className="-translate-y-1/2 first:translate-y-0 last:translate-y-0" key={tick}>
              {`${tick}%`}
            </span>
          ))}
        </div>

        <div
          aria-label={label}
          aria-valuemax={points.length}
          aria-valuemin={1}
          aria-valuenow={(active ?? points.length - 1) + 1}
          aria-valuetext={picked ? `${picked.label}: ${picked.detail}` : undefined}
          className={cn(
            "focus-visible:ring-ring/50 relative h-32 flex-1 touch-pan-y rounded-sm outline-none focus-visible:ring-[3px]",
            MOCK_MARK_CLASS,
          )}
          role="slider"
          tabIndex={0}
          {...handlers}
        >
          {ticks.map((tick) => (
            <span
              aria-hidden="true"
              className="bg-border absolute inset-x-0 h-px"
              key={tick}
              style={{ top: `${toY({ floor, value: tick })}%` }}
            />
          ))}

          <ChartLine floor={floor} values={values} wash />

          {coordinates.map(({ x, y }, index) => (
            <span
              aria-hidden="true"
              className="ring-card pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current ring-2"
              key={points[index]?.key ?? index}
              style={{ left: `${x}%`, top: `${y}%` }}
            />
          ))}

          {picked && activeAt && <ActiveReadout point={picked} x={activeAt.x} y={activeAt.y} />}
        </div>
      </div>

      <div
        aria-hidden="true"
        className="text-muted-foreground flex justify-between pl-11 text-[0.6875rem]"
      >
        <span>{first}</span>
        <span>{latest}</span>
      </div>
    </figure>
  );
}

/**
 * A subject's shares across its mocks as a small line in the quiet color, its latest one marked in
 * the mocks' color. It sits beside the numbers that say the same, so it's hidden from screen readers.
 */
export function Sparkline({ values }: { values: readonly number[] }) {
  const floor = getChartFloor(values);
  const last = toCoordinates({ floor, values }).at(-1);

  return (
    <span aria-hidden="true" className="relative inline-block h-5 w-14 shrink-0">
      <ChartLine className="text-muted-foreground/50" floor={floor} values={values} />
      {last && (
        <span
          className={cn(
            "ring-card absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current ring-2",
            MOCK_MARK_CLASS,
          )}
          style={{ left: `${last.x}%`, top: `${last.y}%` }}
        />
      )}
    </span>
  );
}

/** A sample of the chart, for a learner whose plan doesn't include it yet: no data, no axis. */
export function SampleProgressChart({ values }: { values: readonly number[] }) {
  return (
    <div aria-hidden="true" className={cn("relative h-20", MOCK_MARK_CLASS)}>
      <span className="bg-border absolute inset-x-0 top-0 h-px" />
      <span className="bg-border absolute inset-x-0 bottom-0 h-px" />
      <ChartLine floor={0} values={values} wash />
    </div>
  );
}
