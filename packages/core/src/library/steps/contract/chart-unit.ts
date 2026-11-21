import { type ChartVisual } from "@zoonk/ai/tasks/visuals/schema";
import { splitMoneyUnit } from "@zoonk/utils/math-answer";

/**
 * Money keeps its currency on each number, since only the currency's own format shows cents. Any
 * other unit, and the rest of a money unit ("per hour"), is shown once beside the value label.
 */
export function placeChartUnit({ unit, valueLabel }: Pick<ChartVisual, "unit" | "valueLabel">): {
  currency: string | null;
  valueLabel: string;
} {
  const money = splitMoneyUnit(unit);
  const labelUnit = money ? money.rest : unit;

  return {
    currency: money?.currency ?? null,
    valueLabel: labelUnit ? `${valueLabel} (${labelUnit})` : valueLabel,
  };
}
