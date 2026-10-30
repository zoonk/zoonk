"use client";

import { useFormatNumber } from "@zoonk/learn/format-number";
import { useExtracted } from "next-intl";
import {
  ActivityCanvas,
  ActivityCanvasLabel,
  ActivityReadout,
  ActivityTextAlternative,
} from "../_components/activity-canvas";
import { ActivityPlot } from "../_components/activity-plot";
import { clamp } from "../_utils/snap-value";
import { type ActivityRendererProps } from "../activity-renderer";
import { NumberLineDrawing } from "./number-line-drawing";
import { jumpStops } from "./number-line-geometry";

type NumberLineProps = ActivityRendererProps<"numberLine">;

const PLOT_HEIGHT = 156;

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
  const isExploring = phase === "explore";
  const landing = jumpStops(fields.start, fields.moves).at(-1) ?? fields.start;

  const answered =
    answer?.kind === "numeric" ? clamp(answer.value, fields.min, fields.max) : fields.start;

  const position = isExploring ? landing : answered;
  const moved = position === fields.start ? [] : [position - fields.start];
  const showsMoves = isChecked || isExploring;
  const jumps = showsMoves ? fields.moves.map((move) => move.by) : moved;

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
          isExploring={isExploring}
          onPlace={(value) => onAnswerChange({ kind: "numeric", value })}
          position={position}
        />
      </ActivityPlot>

      <ActivityReadout aria-hidden="true">
        {equation({ format: (value) => format(value), jumps, start: fields.start })}
      </ActivityReadout>

      <ActivityTextAlternative>
        {isExploring
          ? t("A number line for {label} from {min} to {max}. It starts at {start}.", {
              label: fields.label,
              max: format(fields.max),
              min: format(fields.min),
              start: format(fields.start, { unit: fields.unit }),
            })
          : t(
              "A number line for {label} from {min} to {max}. It starts at {start}, and your dot is at {position}.",
              {
                label: fields.label,
                max: format(fields.max),
                min: format(fields.min),
                position: format(position, { unit: fields.unit }),
                start: format(fields.start, { unit: fields.unit }),
              },
            )}
        {showsMoves && " "}
        {showsMoves &&
          t("The jumps go {jumps} and land at {landing}.", {
            jumps: fields.moves.map((move) => format(move.by, { signed: true })).join(", "),
            landing: format(landing, { unit: fields.unit }),
          })}
      </ActivityTextAlternative>
    </ActivityCanvas>
  );
}
