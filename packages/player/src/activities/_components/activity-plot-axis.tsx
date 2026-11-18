"use client";

import { niceTicks, tickCounts } from "@zoonk/utils/plot-scale";
import { usePlotScales } from "./activity-plot";
import { useAxisLabels } from "./use-axis-labels";

const X_LABEL_OFFSET = 18;

export function ActivityPlotAxisX({
  fallbackTicks,
  format,
  ticks,
}: {
  fallbackTicks?: readonly number[][];
  format: (value: number) => string;
  ticks: readonly number[];
}) {
  const { x, y } = usePlotScales();
  const [bottom] = y.range;

  const { ref, shown, starts } = useAxisLabels({
    choices: [
      [...ticks],
      ...(fallbackTicks ??
        tickCounts()
          .slice(1)
          .map((count) => niceTicks(x.domain, count))),
    ],
    domain: x.domain,
    format,
    position: x.toPixel,
    range: x.range,
  });

  return (
    <g aria-hidden="true" data-slot="plot-axis-x" ref={ref}>
      {shown.map((tick) => {
        const label = format(tick);
        const at = x.toPixel(tick);

        return (
          <g key={tick}>
            <path className="stroke-foreground/40" d={`M${at} ${bottom} v4`} strokeWidth={1} />
            <text
              className="fill-muted-foreground"
              textAnchor="start"
              x={starts[tick] ?? at}
              y={bottom + X_LABEL_OFFSET}
            >
              {label}
            </text>
          </g>
        );
      })}
    </g>
  );
}
