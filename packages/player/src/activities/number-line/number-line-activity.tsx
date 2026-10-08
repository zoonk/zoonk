"use client";

import { useFormatNumber } from "@zoonk/learn/format-number";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import {
  ActivityCanvas,
  ActivityCanvasLabel,
  ActivityReadout,
  ActivityTextAlternative,
} from "../_components/activity-canvas";
import { ActivityPlaceHandle, usePlacePointer } from "../_components/activity-place-handle";
import { ActivityPlot, usePlotScales } from "../_components/activity-plot";
import { clamp } from "../_utils/snap-value";
import { type ActivityRendererProps } from "../activity-renderer";
import { jumpArc, jumpStops, numberLineTicks } from "./number-line-geometry";

type NumberLineProps = ActivityRendererProps<"numberLine">;
type Fields = NumberLineProps["content"]["fields"];

const PLOT_HEIGHT = 156;
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
        className="fill-current text-sm font-bold"
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
      <path className="stroke-border" d={`M${left} ${baseline} H${right}`} strokeWidth={2} />
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
                value === 0 ? "fill-foreground font-bold" : "fill-muted-foreground",
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

/** Before the check, one arc from the start to the dot; after it, the writer's jumps. */
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

function NumberLineDrawing({
  fields,
  isChecked,
  onPlace,
  position,
}: {
  fields: Fields;
  isChecked: boolean;
  onPlace: (value: number) => void;
  position: number;
}) {
  const t = useExtracted();
  const format = useFormatNumber();
  const { height, x } = usePlotScales();
  const baseline = height - BASELINE_OFFSET;
  const range = { max: fields.max, min: fields.min, step: fields.step };
  const track = usePlacePointer({ disabled: isChecked, onChange: onPlace, range, scale: x });
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
        isChecked={isChecked}
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
        <circle className="fill-viz-highlight-soft" cx={px} cy={baseline} r={HALO_RADIUS} />
        <circle
          className="fill-viz-highlight stroke-background"
          cx={px}
          cy={baseline}
          r={DOT_RADIUS}
          strokeWidth={2.5}
        />
      </ActivityPlaceHandle>

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

/** "−3 + 3 + 5 = 5": the start, each jump with its sign, and where it lands. */
function equation({
  format,
  jumps,
  start,
}: {
  format: (value: number) => string;
  jumps: readonly number[];
  start: number;
}): string {
  const end = jumps.reduce((sum, jump) => sum + jump, start);
  const terms = jumps.map((jump) => `${jump < 0 ? "\u2212" : "+"} ${format(Math.abs(jump))}`);

  return jumps.length === 0
    ? format(start)
    : `${[format(start), ...terms].join(" ")} = ${format(end)}`;
}

/**
 * The learner drags a dot to where a change lands. Before the check an arc shows the jump they
 * made; after it, the writer's jumps (like +3 to zero, then +5) show why, crossing zero step by
 * step. The dot's position is the numeric answer, and typing a number moves the dot.
 */
export function NumberLineActivity({
  answer,
  content,
  labelId,
  onAnswerChange,
  phase,
}: NumberLineProps) {
  const t = useExtracted();
  const format = useFormatNumber();
  const { fields } = content;
  const isChecked = phase === "checked";

  const position =
    answer?.kind === "numeric" ? clamp(answer.value, fields.min, fields.max) : fields.start;

  const landing = jumpStops(fields.start, fields.moves).at(-1) ?? fields.start;
  const moved = position === fields.start ? [] : [position - fields.start];
  const jumps = isChecked ? fields.moves.map((move) => move.by) : moved;

  return (
    <ActivityCanvas labelId={labelId}>
      <ActivityCanvasLabel className="text-sm">
        {fields.unit
          ? t("{label} in {unit}", { label: fields.label, unit: fields.unit })
          : fields.label}
      </ActivityCanvasLabel>

      <ActivityPlot
        height={PLOT_HEIGHT}
        padding={{ bottom: 8, left: 20, right: 20, top: 8 }}
        xDomain={[fields.min, fields.max]}
        yDomain={[0, 1]}
      >
        <NumberLineDrawing
          fields={fields}
          isChecked={isChecked}
          onPlace={(value) => onAnswerChange({ kind: "numeric", value })}
          position={position}
        />
      </ActivityPlot>

      <ActivityReadout aria-hidden="true">
        {equation({ format: (value) => format(value), jumps, start: fields.start })}
      </ActivityReadout>

      <ActivityTextAlternative>
        {t(
          "A number line for {label} from {min} to {max}. It starts at {start}, and your dot is at {position}.",
          {
            label: fields.label,
            max: format(fields.max),
            min: format(fields.min),
            position: format(position, { unit: fields.unit }),
            start: format(fields.start, { unit: fields.unit }),
          },
        )}
        {isChecked && " "}
        {isChecked &&
          t("The jumps go {jumps} and land at {landing}.", {
            jumps: fields.moves.map((move) => format(move.by, { signed: true })).join(", "),
            landing: format(landing, { unit: fields.unit }),
          })}
      </ActivityTextAlternative>
    </ActivityCanvas>
  );
}
