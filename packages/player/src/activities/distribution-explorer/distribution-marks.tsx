"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { ActivityPlaceHandle } from "../_components/activity-place-handle";
import { usePlotScales } from "../_components/activity-plot";
import { type SnapRange } from "../_utils/snap-value";

const PILL_HEIGHT = 26;
const PILL_PADDING = 10;
const CHAR_WIDTH = 8;
const PILL_OFFSET = 18;
const TICK_OFFSET = 18;
/** Axis labels sit a little lower than the pills' middle, level with their text. */
const TICK_DROP = 4;
const TARGET_LABEL_RISE = 4;
/** Axis labels closer than this to a handle hide behind its pill. */
const TICK_CLEARANCE = 28;
const TAIL_GAP = 6;
const TAIL_RISE = 14;
const MIN_TAIL_ROOM = 34;

function pillWidth(label: string): number {
  return label.length * CHAR_WIDTH + 2 * PILL_PADDING;
}

/**
 * One of the two handles: a line across the curve with its value in a pill on the axis. It's a
 * slider for keyboards and screen readers and a drag target for pointers.
 */
export function DistributionHandle({
  disabled,
  label,
  onChange,
  range,
  value,
  valueLabel,
  valueText,
}: {
  disabled: boolean;
  label: string;
  onChange: (value: number) => void;
  range: SnapRange;
  value: number;
  valueLabel: string;
  valueText: string;
}) {
  const { x, y } = usePlotScales();
  const [bottom, top] = y.range;
  const cx = x.toPixel(value);
  const cy = bottom + PILL_OFFSET;
  const width = pillWidth(valueLabel);

  return (
    <ActivityPlaceHandle
      cx={cx}
      cy={cy}
      disabled={disabled}
      label={label}
      onChange={onChange}
      range={range}
      scale={x}
      value={value}
      valueText={valueText}
    >
      <path className="stroke-viz-accent" d={`M${cx} ${top} V${cy}`} strokeWidth={2} />
      <rect
        className="fill-viz-accent stroke-ring stroke-0 group-focus-visible/handle:stroke-3"
        height={PILL_HEIGHT}
        rx={PILL_HEIGHT / 2}
        width={width}
        x={cx - width / 2}
        y={cy - PILL_HEIGHT / 2}
      />
      <text
        className="fill-background text-[13px] font-bold tabular-nums"
        dominantBaseline="central"
        textAnchor="middle"
        x={cx}
        y={cy}
      >
        {valueLabel}
      </text>
    </ActivityPlaceHandle>
  );
}

/** The baseline and its labels (the average and whole SDs), hidden where a handle's pill sits. */
export function DistributionTicks({
  format,
  handles,
  ticks,
}: {
  format: (value: number) => string;
  handles: readonly number[];
  ticks: readonly number[];
}) {
  const { x, y } = usePlotScales();
  const [bottom] = y.range;
  const [left, right] = x.range;

  const visible = ticks.filter((tick) =>
    handles.every((handle) => Math.abs(x.toPixel(tick) - x.toPixel(handle)) >= TICK_CLEARANCE),
  );

  return (
    <g aria-hidden="true">
      <path className="stroke-border" d={`M${left} ${bottom} H${right}`} strokeWidth={1.5} />
      {visible.map((tick) => (
        <text
          className="fill-muted-foreground"
          key={tick}
          textAnchor="middle"
          x={x.toPixel(tick)}
          y={bottom + TICK_OFFSET + TICK_DROP}
        >
          {format(tick)}
        </text>
      ))}
    </g>
  );
}

/** The share of values beyond each handle, just outside it, when there's room to read it. */
export function DistributionTails({
  below,
  above,
  handles,
}: {
  above: string;
  below: string;
  handles: readonly [number, number];
}) {
  const { x, y } = usePlotScales();
  const [bottom] = y.range;
  const [left, right] = x.range;
  const [from, to] = [x.toPixel(handles[0]), x.toPixel(handles[1])];

  return (
    <g
      aria-hidden="true"
      className="fill-muted-foreground stroke-background stroke-[4px] [paint-order:stroke] [stroke-linejoin:round]"
    >
      {from - left >= MIN_TAIL_ROOM && (
        <text textAnchor="end" x={from - TAIL_GAP} y={bottom - TAIL_RISE}>
          {below}
        </text>
      )}
      {right - to >= MIN_TAIL_ROOM && (
        <text textAnchor="start" x={to + TAIL_GAP} y={bottom - TAIL_RISE}>
          {above}
        </text>
      )}
    </g>
  );
}

/** Once checked, the range the check is about, outlined with its share. */
export function DistributionTarget({
  label,
  target,
}: {
  label: string;
  target: { from: number; to: number };
}) {
  const { x, y } = usePlotScales();
  const [bottom, top] = y.range;
  const [from, to] = [x.toPixel(target.from), x.toPixel(target.to)];

  return (
    <g aria-hidden="true">
      <path
        className="stroke-success"
        d={`M${from} ${bottom} V${top} M${to} ${bottom} V${top}`}
        strokeDasharray="4 3"
        strokeWidth={2}
      />
      <text
        className={cn("fill-success text-xs font-semibold")}
        textAnchor="middle"
        x={(from + to) / 2}
        y={top - TARGET_LABEL_RISE}
      >
        {label}
      </text>
    </g>
  );
}

/** A dashed line at the average, the middle of a normal curve. */
export function DistributionMean({ value }: { value: number }) {
  const { x, y } = usePlotScales();
  const [bottom, top] = y.range;

  return (
    <path
      aria-hidden="true"
      className="stroke-muted-foreground/50"
      d={`M${x.toPixel(value)} ${bottom} V${top}`}
      strokeDasharray="3 4"
    />
  );
}
