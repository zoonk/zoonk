"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { ActivityCanvasLabel } from "../_components/activity-canvas";
import {
  ActivityPlot,
  ActivityPlotAxisX,
  ActivityPlotDot,
  ActivityPlotGridY,
  ActivityPlotLine,
} from "../_components/activity-plot";
import { useFormatNumber } from "../_utils/use-format-number";
import { FULL_TURN } from "./unit-circle-angle";
import { type TrigName, useTrigNames } from "./use-unit-circle-format";

type WaveName = Exclude<TrigName, "tan">;

const PLOT_HEIGHT = 112;
const SAMPLE_STEP = 5;
const HALF_TURN = 180;
const QUARTER_TURN = 90;
const DOT_RADIUS = 5;
const WAVE_TICKS = [QUARTER_TURN, HALF_TURN, HALF_TURN + QUARTER_TURN, FULL_TURN];

const WAVES: Record<
  WaveName,
  { dot: string; line: string; swatch: string; value: (radians: number) => number }
> = {
  cos: {
    dot: "fill-viz-secondary",
    line: "stroke-viz-secondary",
    swatch: "bg-viz-secondary",
    value: Math.cos,
  },
  sin: {
    dot: "fill-viz-highlight",
    line: "stroke-viz-highlight",
    swatch: "bg-viz-highlight",
    value: Math.sin,
  },
};

function wavePoints(name: WaveName, upTo: number): { x: number; y: number }[] {
  const count = Math.floor(upTo / SAMPLE_STEP);
  const xs = [...Array.from({ length: count + 1 }, (_, index) => index * SAMPLE_STEP), upTo];

  return [...new Set(xs)].map((degrees) => ({
    x: degrees,
    y: WAVES[name].value((degrees * Math.PI) / HALF_TURN),
  }));
}

export function isWave(name: TrigName): name is WaveName {
  return name !== "tan";
}

/**
 * The sine and cosine drawn as waves over one turn: solid up to the point's angle, dotted after,
 * so turning the point draws the wave.
 */
export function UnitCircleWave({
  degrees,
  formatAngle,
  show,
}: {
  degrees: number;
  formatAngle: (degrees: number) => string;
  show: readonly WaveName[];
}) {
  const t = useExtracted();
  const format = useFormatNumber();
  const names = useTrigNames();

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ActivityCanvasLabel>{t("As the point turns")}</ActivityCanvasLabel>

        {show.length > 1 && (
          <div aria-hidden="true" className="text-muted-foreground flex gap-3 text-xs">
            {show.map((name) => (
              <span className="flex items-center gap-1.5" key={name}>
                <span className={cn("h-1 w-3 rounded-full", WAVES[name].swatch)} />
                {names[name]}
              </span>
            ))}
          </div>
        )}
      </div>

      <ActivityPlot
        height={PLOT_HEIGHT}
        padding={{ left: 28 }}
        xDomain={[0, FULL_TURN]}
        yDomain={[-1, 1]}
      >
        <ActivityPlotGridY format={(value) => format(value)} ticks={[-1, 0, 1]} />
        <ActivityPlotAxisX format={formatAngle} ticks={WAVE_TICKS} />

        {show.map((name) => (
          <g key={name}>
            <ActivityPlotLine
              className="stroke-muted-foreground/40 stroke-2 [stroke-dasharray:2_5]"
              points={wavePoints(name, FULL_TURN)}
            />
            <ActivityPlotLine className={WAVES[name].line} points={wavePoints(name, degrees)} />
            <ActivityPlotDot
              className={WAVES[name].dot}
              radius={DOT_RADIUS}
              x={degrees}
              y={WAVES[name].value((degrees * Math.PI) / HALF_TURN)}
            />
          </g>
        ))}
      </ActivityPlot>
    </div>
  );
}
