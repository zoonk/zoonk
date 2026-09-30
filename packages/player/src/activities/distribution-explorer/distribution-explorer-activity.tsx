"use client";

import { useExtracted } from "next-intl";
import { useState } from "react";
import {
  ActivityCanvas,
  ActivityCanvasLabel,
  ActivityReadout,
  ActivityTextAlternative,
} from "../_components/activity-canvas";
import { ActivityPlot, ActivityPlotArea, ActivityPlotLine } from "../_components/activity-plot";
import { computeActivityValue } from "../_utils/compute-activity-value";
import { useFormatNumber } from "../_utils/use-format-number";
import { type ActivityRendererProps } from "../activity-renderer";
import {
  type Interval,
  densityCurve,
  distributionDomain,
  distributionTicks,
  handleStep,
  snapDomain,
} from "./distribution";
import {
  DistributionHandle,
  DistributionMean,
  DistributionTails,
  DistributionTarget,
  DistributionTicks,
} from "./distribution-marks";

type DistributionExplorerProps = ActivityRendererProps<"distributionExplorer">;
type Content = DistributionExplorerProps["content"];

const PLOT_HEIGHT = 196;
const PLOT_PADDING = { bottom: 46, left: 12, right: 12, top: 22 };
const HEADROOM = 1.08;
const PERCENT_DIGITS = 1;
/** Far enough past the curve's end that the share beyond it is zero to the digit shown. */
const FAR_SDS = 40;

/**
 * The percent of values in a range, from core's template hook with that range as the target: the
 * same math that grades the check, so the readout can't disagree with it.
 */
function percentBetween(content: Content, range: Interval): number {
  return computeActivityValue({ ...content, fields: { ...content.fields, target: range } }) ?? 0;
}

function farEnds(distribution: Content["fields"]["distribution"]): Interval {
  return distribution.kind === "normal"
    ? {
        from: distribution.mean - FAR_SDS * distribution.sd,
        to: distribution.mean + FAR_SDS * distribution.sd,
      }
    : { from: distribution.min, to: distribution.max };
}

/**
 * Drag two handles along a distribution and read the percent of values between them, with the
 * tails outside each handle. With a numeric check, the percent between the handles is the
 * learner's answer; once checked, the range the check asks about is outlined.
 */
export function DistributionExplorerActivity({
  content,
  labelId,
  onAnswerChange,
  phase,
}: DistributionExplorerProps) {
  const t = useExtracted();
  const format = useFormatNumber();
  const { check, fields } = content;
  const { distribution } = fields;
  const [handles, setHandles] = useState(fields.handles);
  const isChecked = phase === "checked";
  const rawDomain = distributionDomain(fields);
  const step = handleStep({ ...fields, domain: rawDomain });
  const domain = snapDomain(rawDomain, step);
  const curve = densityCurve(distribution, domain);
  const peak = Math.max(...curve.map((point) => point.y));
  const ends = farEnds(distribution);
  const between = percentBetween(content, handles);
  const below = percentBetween(content, { from: ends.from, to: handles.from });
  const above = percentBetween(content, { from: handles.to, to: ends.to });

  const percent = (value: number) =>
    format(value, { maximumFractionDigits: PERCENT_DIGITS, unit: "%" });

  const formatValue = (value: number) => format(value, { unit: fields.unit });

  function handleChange(next: Interval) {
    setHandles(next);

    if (check.kind === "numeric") {
      onAnswerChange({ kind: "numeric", value: percentBetween(content, next) });
    }
  }

  const rangeLabel = t("{label} from {from} to {to}", {
    from: format(handles.from),
    label: fields.valueLabel,
    to: format(handles.to),
  });

  const handleValueText = (value: number) =>
    t("{value}. {share} between the handles.", {
      share: percent(between),
      value: formatValue(value),
    });

  /* Computed like the readout, so the outline and the readout agree to the digit. */
  const targetShare = percentBetween(content, fields.target);

  return (
    <ActivityCanvas labelId={labelId}>
      <div className="flex items-start justify-between gap-3">
        <ActivityCanvasLabel className="text-sm">{rangeLabel}</ActivityCanvasLabel>
        <ActivityReadout aria-hidden="true" className="text-viz-accent">
          {percent(between)}
        </ActivityReadout>
      </div>

      <ActivityPlot
        height={PLOT_HEIGHT}
        padding={PLOT_PADDING}
        xDomain={domain}
        yDomain={[0, peak * HEADROOM]}
      >
        <ActivityPlotArea
          points={curve.filter((point) => point.x >= handles.from && point.x <= handles.to)}
        />
        {distribution.kind === "normal" && <DistributionMean value={distribution.mean} />}
        <ActivityPlotLine className="stroke-2" points={curve} />

        <DistributionTicks
          format={(value) => format(value)}
          handles={[handles.from, handles.to]}
          ticks={distributionTicks(distribution, domain)}
        />

        {isChecked && (
          <DistributionTarget
            label={t("{from} to {to}: {share}", {
              from: format(fields.target.from),
              share: percent(targetShare),
              to: format(fields.target.to),
            })}
            target={fields.target}
          />
        )}

        {/* Over the checked range's lines, so their halo keeps the shares readable. */}
        <DistributionTails
          above={percent(above)}
          below={percent(below)}
          handles={[handles.from, handles.to]}
        />

        <DistributionHandle
          disabled={isChecked}
          label={t("Lower handle")}
          onChange={(from) => handleChange({ ...handles, from })}
          range={{ max: handles.to - step, min: domain[0], step }}
          value={handles.from}
          valueLabel={format(handles.from)}
          valueText={handleValueText(handles.from)}
        />

        <DistributionHandle
          disabled={isChecked}
          label={t("Upper handle")}
          onChange={(to) => handleChange({ ...handles, to })}
          range={{ max: domain[1], min: handles.from + step, step }}
          value={handles.to}
          valueLabel={format(handles.to)}
          valueText={handleValueText(handles.to)}
        />
      </ActivityPlot>

      <ActivityTextAlternative>
        {distribution.kind === "normal"
          ? t(
              "A bell curve of {label}, with an average of {mean} and a standard deviation of {sd}.",
              {
                label: fields.valueLabel,
                mean: formatValue(distribution.mean),
                sd: formatValue(distribution.sd),
              },
            )
          : t("A flat distribution of {label}, from {min} to {max}.", {
              label: fields.valueLabel,
              max: formatValue(distribution.max),
              min: formatValue(distribution.min),
            })}{" "}
        {t("{between} of values fall between {from} and {to}, {below} below and {above} above.", {
          above: percent(above),
          below: percent(below),
          between: percent(between),
          from: formatValue(handles.from),
          to: formatValue(handles.to),
        })}
      </ActivityTextAlternative>
    </ActivityCanvas>
  );
}
