"use client";

import { useFormatNumber } from "@zoonk/learn/format-number";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { ActivityPlaceHandle, usePlacePointer } from "../_components/activity-place-handle";
import { usePlotScales } from "../_components/activity-plot";
import { type ActivityRendererProps } from "../activity-renderer";
import { jumpArc, jumpStops, numberLineTicks } from "./number-line-geometry";

type Fields = ActivityRendererProps<"numberLine">["content"]["fields"];

const BASELINE_OFFSET = 40;
const TICK = 6;
const ZERO_TICK = 12;
const LABEL_OFFSET = 26;
const START_RADIUS = 7;
const DOT_RADIUS = 10;
const HALO_RADIUS = 15;
const LANDING_RADIUS = 14;
const TRACK_HIT = 22;
const TICK_STROKE = 1.5;

function JumpMark({
  baseline,
  className,
  from,
  label,
  to,
}: {
  baseline: number;
  className: string;
  from: number;
  label: string;
  to: number;
}) {
  const { x } = usePlotScales();
  const arc = jumpArc({ baseline: baseline - TICK, from: x.toPixel(from), to: x.toPixel(to) });

  return (
    <g aria-hidden="true" className={className}>
      <path
        className="fill-none stroke-current"
        d={arc.path}
        strokeLinecap="round"
        strokeWidth={2.5}
      />
      <path
        className="fill-none stroke-current"
        d={arc.head}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.5}
      />
      <text
        className="fill-current text-sm font-semibold"
        textAnchor="middle"
        x={arc.labelX}
        y={arc.labelY}
      >
        {label}
      </text>
    </g>
  );
}

function NumberLineAxis({ baseline, fields }: { baseline: number; fields: Fields }) {
  const { x } = usePlotScales();
  const format = useFormatNumber();
  const [left, right] = x.range;

  return (
    <g aria-hidden="true">
      <path className="stroke-viz-grid" d={`M${left} ${baseline} H${right}`} strokeWidth={2} />
      {numberLineTicks(fields).map(({ isLabelled, value }) => (
        <g key={value}>
          <path
            className={value === 0 ? "stroke-foreground" : "stroke-muted-foreground"}
            d={`M${x.toPixel(value)} ${baseline - (value === 0 ? ZERO_TICK : TICK)} V${baseline + (value === 0 ? ZERO_TICK : TICK)}`}
            strokeWidth={value === 0 ? 2 : TICK_STROKE}
          />
          {isLabelled && (
            <text
              className={cn(
                "tabular-nums",
                value === 0 ? "fill-foreground font-semibold" : "fill-muted-foreground",
              )}
              textAnchor="middle"
              x={x.toPixel(value)}
              y={baseline + LABEL_OFFSET}
            >
              {format(value)}
            </text>
          )}
        </g>
      ))}
    </g>
  );
}

function NumberLineJumps({
  baseline,
  fields,
  isChecked,
  position,
}: {
  baseline: number;
  fields: Fields;
  isChecked: boolean;
  position: number;
}) {
  const format = useFormatNumber();
  const stops = jumpStops(fields.start, fields.moves);

  if (!isChecked) {
    return position === fields.start ? null : (
      <JumpMark
        baseline={baseline}
        className="text-viz-highlight"
        from={fields.start}
        label={format(position - fields.start, { signed: true })}
        to={position}
      />
    );
  }

  return fields.moves.map((move, index) => (
    <JumpMark
      baseline={baseline}
      className={index % 2 === 0 ? "text-viz-secondary" : "text-viz-highlight"}
      from={stops[index] ?? fields.start}
      // oxlint-disable-next-line react/no-array-index-key -- Moves can repeat and have no id
      key={index}
      label={move.label ?? format(move.by, { signed: true })}
      to={stops[index + 1] ?? fields.start}
    />
  ));
}

function NumberLineDot({ baseline, x }: { baseline: number; x: number }) {
  return (
    <>
      <circle className="fill-viz-highlight-soft" cx={x} cy={baseline} r={HALO_RADIUS} />
      <circle
        className="fill-viz-highlight stroke-background"
        cx={x}
        cy={baseline}
        r={DOT_RADIUS}
        strokeWidth={2.5}
      />
    </>
  );
}

export function NumberLineDrawing({
  fields,
  isChecked,
  isExploring,
  onPlace,
  position,
}: {
  fields: Fields;
  isChecked: boolean;
  isExploring: boolean;
  onPlace: (value: number) => void;
  position: number;
}) {
  const t = useExtracted();
  const format = useFormatNumber();
  const { height, x } = usePlotScales();
  const baseline = height - BASELINE_OFFSET;
  const range = { max: fields.max, min: fields.min, step: fields.step };
  const isLocked = isChecked || isExploring;
  const track = usePlacePointer({ disabled: isLocked, onChange: onPlace, range, scale: x });
  const [left, right] = x.range;
  const [px, startX] = [x.toPixel(position), x.toPixel(fields.start)];
  const landing = jumpStops(fields.start, fields.moves).at(-1) ?? fields.start;

  return (
    <>
      <rect
        className="fill-transparent"
        height={TRACK_HIT * 2}
        width={right - left}
        x={left}
        y={baseline - TRACK_HIT}
        {...track}
      />
      <NumberLineAxis baseline={baseline} fields={fields} />
      <NumberLineJumps
        baseline={baseline}
        fields={fields}
        isChecked={isLocked}
        position={position}
      />
      <circle
        aria-hidden="true"
        className="fill-viz-secondary stroke-background"
        cx={startX}
        cy={baseline}
        r={START_RADIUS}
        strokeWidth={2}
      />

      {isExploring ? (
        <g aria-hidden="true">
          <NumberLineDot baseline={baseline} x={px} />
        </g>
      ) : (
        <ActivityPlaceHandle
          cx={px}
          cy={baseline}
          disabled={isChecked}
          label={t("Your answer on the number line")}
          onChange={onPlace}
          range={range}
          scale={x}
          value={position}
          valueText={format(position, { unit: fields.unit })}
        >
          <NumberLineDot baseline={baseline} x={px} />
        </ActivityPlaceHandle>
      )}

      {isChecked && (
        <circle
          aria-hidden="true"
          className="stroke-success fill-none"
          cx={x.toPixel(landing)}
          cy={baseline}
          r={LANDING_RADIUS}
          strokeWidth={3}
        />
      )}
    </>
  );
}
