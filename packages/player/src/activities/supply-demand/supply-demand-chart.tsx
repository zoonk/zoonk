"use client";

import { useExtracted } from "next-intl";
import { useId } from "react";
import { ActivityPlaceHandle } from "../_components/activity-place-handle";
import { ActivityPlot, usePlotScales } from "../_components/activity-plot";
import { createLinearScale } from "../_utils/plot-scale";
import {
  Axes,
  ChangeArrows,
  ClipArea,
  Crossing,
  CurveLabel,
  CurveLine,
  pointAlong,
} from "./supply-demand-marks";
import {
  type Curve,
  type CurveOffsets,
  type Line,
  chartDomain,
  equilibrium,
  shiftRange,
  shiftedCurves,
} from "./supply-demand-model";

type Fields = {
  demand: Line;
  priceLabel: string;
  quantityLabel: string;
  shift: { amount: number };
  supply: Line;
};

const PLOT_HEIGHT = 248;
const PADDING = { bottom: 30, left: 22, right: 18, top: 26 };
const HANDLE_RADIUS = 14;
const CHEVRON = 4;

/**
 * Where each curve's handle sits along its visible stretch: toward the right end, away from where
 * the curves cross, so the handles never cover the crossing.
 */
const HANDLE_SHARE = 0.82;

const CURVE_CLASS: Record<Curve, string> = {
  demand: "stroke-viz-secondary",
  supply: "stroke-viz-highlight",
};

/** Text colors for labels and handles, which draw their own strokes with `currentColor`. */
const CURVE_TEXT_CLASS: Record<Curve, string> = {
  demand: "text-viz-secondary",
  supply: "text-viz-highlight",
};

/** A curve's drag handle: a slider for keyboards, a 44px drag target for pointers. */
function CurveHandle({
  curve,
  disabled,
  domain,
  label,
  line,
  offset,
  onChange,
  valueText,
  amount,
}: {
  amount: number;
  curve: Curve;
  disabled: boolean;
  domain: { price: number; quantity: number };
  label: string;
  line: Line;
  offset: number;
  onChange: (offset: number) => void;
  valueText: string;
}) {
  const { x, y } = usePlotScales();
  const range = shiftRange(amount);
  const { price, quantity: home } = pointAlong(line, domain, HANDLE_SHARE);

  const scale = createLinearScale({
    domain: [range.min, range.max],
    range: [x.toPixel(home + range.min), x.toPixel(home + range.max)],
  });

  const [cx, cy] = [scale.toPixel(offset), y.toPixel(price)];

  return (
    <ActivityPlaceHandle
      className={CURVE_TEXT_CLASS[curve]}
      cx={cx}
      cy={cy}
      disabled={disabled}
      label={label}
      onChange={onChange}
      range={range}
      scale={scale}
      value={offset}
      valueText={valueText}
    >
      <circle
        className="fill-background stroke-current"
        cx={cx}
        cy={cy}
        r={HANDLE_RADIUS}
        strokeWidth={2.5}
      />
      <path
        className="fill-none stroke-current"
        d={`M${cx - 2} ${cy - CHEVRON} l-${CHEVRON} ${CHEVRON} l${CHEVRON} ${CHEVRON} M${cx + 2} ${cy - CHEVRON} l${CHEVRON} ${CHEVRON} l-${CHEVRON} ${CHEVRON}`}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </ActivityPlaceHandle>
  );
}

/**
 * Supply and demand as two straight curves the learner drags left or right by their handles.
 * The curve's starting place stays dashed, both crossings are marked, and arrows on the axes
 * show what the move did to price and quantity. After the check, the real shift is drawn too.
 */
export function SupplyDemandChart({
  answerLine,
  fields,
  handleText,
  isChecked,
  offsets,
  onMove,
}: {
  /** The curve where it really moved, drawn after the check when the learner's move differs. */
  answerLine: { curve: Curve; line: Line } | null;
  fields: Fields;
  handleText: (curve: Curve) => { label: string; valueText: string };
  isChecked: boolean;
  offsets: CurveOffsets;
  onMove: (curve: Curve, offset: number) => void;
}) {
  const t = useExtracted();
  const clipId = useId();
  const domain = chartDomain(fields);
  const lines = shiftedCurves(fields, offsets);
  const before = equilibrium(fields.supply, fields.demand);
  const after = equilibrium(lines.supply, lines.demand);
  const curves: Curve[] = ["supply", "demand"];
  const moved = curves.filter((curve) => offsets[curve] !== 0);
  const names: Record<Curve, string> = { demand: t("Demand"), supply: t("Supply") };

  return (
    <ActivityPlot
      height={PLOT_HEIGHT}
      padding={PADDING}
      xDomain={[0, domain.quantity]}
      yDomain={[0, domain.price]}
    >
      <ClipArea id={clipId} />
      <Axes fields={fields} />

      <g clipPath={`url(#${clipId})`}>
        {moved.map((curve) => (
          <CurveLine
            className="stroke-muted-foreground"
            domain={domain}
            isDashed
            key={`${curve}-before`}
            line={fields[curve]}
          />
        ))}

        {answerLine && (
          <CurveLine className="stroke-success" domain={domain} isDashed line={answerLine.line} />
        )}

        {curves.map((curve) => (
          <CurveLine
            className={CURVE_CLASS[curve]}
            domain={domain}
            key={curve}
            line={lines[curve]}
          />
        ))}
      </g>

      {moved.map((curve) => (
        <CurveLabel
          className="text-muted-foreground"
          domain={domain}
          end="lower"
          key={`${curve}-before`}
          label={t("Before")}
          line={fields[curve]}
        />
      ))}

      {answerLine && (
        <CurveLabel
          className="text-success"
          domain={domain}
          end="lower"
          label={t("What happened")}
          line={answerLine.line}
        />
      )}

      {curves.map((curve) => (
        <CurveLabel
          className={CURVE_TEXT_CLASS[curve]}
          domain={domain}
          end="upper"
          key={curve}
          label={names[curve]}
          line={lines[curve]}
        />
      ))}

      {moved.length > 0 && (
        <>
          <Crossing isBefore point={before} />
          <ChangeArrows after={after} before={before} />
        </>
      )}

      <Crossing isBefore={false} point={after} />

      {curves.map((curve) => (
        <CurveHandle
          amount={fields.shift.amount}
          curve={curve}
          disabled={isChecked}
          domain={domain}
          key={curve}
          line={fields[curve]}
          offset={offsets[curve]}
          onChange={(offset) => onMove(curve, offset)}
          {...handleText(curve)}
        />
      ))}
    </ActivityPlot>
  );
}
