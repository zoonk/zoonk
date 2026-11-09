import { CHART_UNIT_TARGET, type ChartVisual } from "@zoonk/ai/tasks/visuals/schema";
import { splitMoneyUnit } from "@zoonk/utils/math-answer";

/**
 * A unit within its target follows each number on the chart ("35 km"). A longer one, such as
 * "hours per 1,000 letters", would crowd every tick and bar, so it's shown once beside the value
 * label, the way the Apple app shows every unit. Money keeps its currency on each number, since
 * only the currency's own format shows cents.
 */
export function placeChartUnit({ unit, valueLabel }: Pick<ChartVisual, "unit" | "valueLabel">): {
  numberUnit: string | null;
  valueLabel: string;
} {
  if (!unit || unit.length <= CHART_UNIT_TARGET) {
    return { numberUnit: unit, valueLabel };
  }

  const money = splitMoneyUnit(unit);

  return {
    numberUnit: money?.currency ?? null,
    valueLabel: `${valueLabel} (${money?.rest ?? unit})`,
  };
}
