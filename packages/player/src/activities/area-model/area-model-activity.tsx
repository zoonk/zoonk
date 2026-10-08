"use client";

import { useFormatNumber } from "@zoonk/learn/format-number";
import { useExtracted } from "next-intl";
import { useState } from "react";
import {
  ActivityCanvas,
  ActivityReadout,
  ActivityTextAlternative,
} from "../_components/activity-canvas";
import { ActivityPlot } from "../_components/activity-plot";
import { type ActivityRendererProps } from "../activity-renderer";
import { BarModel } from "./area-model-bar";
import { cutsToParts, partsToCuts, splitStep } from "./area-model-cuts";
import { AreaGrid, type SideCuts } from "./area-model-grid";

type AreaModelProps = ActivityRendererProps<"areaModel">;
type Fields = AreaModelProps["content"]["fields"];
type Side = { parts: number[]; total: number };

const GRID_PADDING = { bottom: 4, left: 36, right: 8, top: 28 };
const BAR_PADDING = { bottom: 8, left: 8, right: 8, top: 32 };
const BAR_HEIGHT = 88;
const MIN_GRID_HEIGHT = 140;
const MAX_GRID_HEIGHT = 260;

function sidesOf(fields: Fields): Side[] {
  return fields.model === "area" ? [fields.width, fields.height] : [fields.bar];
}

function initialCuts(fields: Fields): SideCuts[] {
  return sidesOf(fields).map((side) => ({
    cuts: partsToCuts(side.parts),
    step: splitStep(side.parts),
    total: side.total,
  }));
}

/** The grid keeps the rectangle's proportions within a readable height range. */
function gridHeight(fields: Fields) {
  return (width: number) => {
    if (fields.model !== "area") {
      return BAR_HEIGHT;
    }

    const drawn =
      ((width - GRID_PADDING.left - GRID_PADDING.right) * fields.height.total) / fields.width.total;

    return (
      Math.min(Math.max(drawn, MIN_GRID_HEIGHT), MAX_GRID_HEIGHT) +
      GRID_PADDING.top +
      GRID_PADDING.bottom
    );
  };
}

/** Each cell's product (area model) or each part (bar model), row by row. */
function pieces(sides: readonly { parts: number[] }[]): number[] {
  const [first, second] = sides;

  if (!first) {
    return [];
  }

  return second
    ? second.parts.flatMap((height) => first.parts.map((width) => width * height))
    : first.parts;
}

/**
 * Splits a rectangle (or a bar) into easy parts by dragging split lines, with each part's size
 * worked out live. The parts always add up to the same total, which is the idea. The canvas
 * never answers a numeric check: the learner adds the parts and types the total.
 */
export function AreaModelActivity({ content, labelId, phase }: AreaModelProps) {
  const t = useExtracted();
  const format = useFormatNumber();
  const { check, fields } = content;
  const [sides, setSides] = useState(() => initialCuts(fields));
  const isChecked = phase === "checked";
  const parts = sides.map((side) => ({ parts: cutsToParts(side.cuts, side.total) }));
  const values = pieces(parts);
  const total = values.reduce((sum, value) => sum + value, 0);
  const hidesTotal = check.kind === "numeric" && !isChecked;
  const unit = fields.model === "area" && fields.unit ? `${fields.unit}²` : fields.unit;
  const sum = `${values.map((value) => format(value)).join(" + ")} = ${hidesTotal ? "?" : format(total, { unit })}`;

  function handleCut(sideIndex: number, cuts: number[]) {
    setSides((current) =>
      current.map((side, index) => (index === sideIndex ? { ...side, cuts } : side)),
    );
  }

  return (
    <ActivityCanvas labelId={labelId}>
      <ActivityPlot
        height={gridHeight(fields)}
        padding={fields.model === "area" ? GRID_PADDING : BAR_PADDING}
        xDomain={[0, sides[0]?.total ?? 1]}
        yDomain={[sides[1]?.total ?? 1, 0]}
      >
        {fields.model === "area" ? (
          <AreaGrid disabled={isChecked} height={sides[1]} onCut={handleCut} width={sides[0]} />
        ) : (
          <BarModel bar={sides[0]} disabled={isChecked} onCut={handleCut} />
        )}
      </ActivityPlot>

      <ActivityReadout aria-hidden="true" className="text-lg">
        {sum}
      </ActivityReadout>

      <ActivityTextAlternative>
        {t("Split into {count} parts: {parts}.", {
          count: String(values.length),
          parts: values.map((value) => format(value)).join(", "),
        })}
        {!hidesTotal && " "}
        {!hidesTotal && t("Together they make {total}.", { total: format(total, { unit }) })}
      </ActivityTextAlternative>
    </ActivityCanvas>
  );
}
