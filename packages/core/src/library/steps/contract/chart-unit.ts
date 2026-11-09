import { CHART_UNIT_TARGET, type ChartVisual } from "@zoonk/ai/tasks/visuals/schema";

/**
 * A unit within its target follows each number on the chart ("35 km"). A longer one, such as
 * "hours per 1,000 letters", would crowd every tick and bar, so it's shown once beside the value
 * label, the way the Apple app shows every unit.
 */
export function placeChartUnit({ unit, valueLabel }: Pick<ChartVisual, "unit" | "valueLabel">): {
  numberUnit: string | null;
  valueLabel: string;
} {
  if (!unit || unit.length <= CHART_UNIT_TARGET) {
    return { numberUnit: unit, valueLabel };
  }

  return { numberUnit: null, valueLabel: `${valueLabel} (${unit})` };
}
