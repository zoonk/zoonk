import { isAttachedUnit, splitMoneyUnit } from "@zoonk/utils/math-answer";

/**
 * A unit that is part of how the number is written stays on each tick and value label: a currency,
 * since only its own format shows cents ("$3.50"), and a sign written against the digits ("45%").
 * Any other unit, and the rest of a money unit ("per hour"), is shown once beside the axis label,
 * as "Distance (km)". Category charts and plots follow the same rule.
 */
export function placeChartUnit({ label, unit }: { label: string; unit: string | null }): {
  label: string;
  numberUnit: string | null;
} {
  const money = splitMoneyUnit(unit);

  if (money) {
    return { label: money.rest ? `${label} (${money.rest})` : label, numberUnit: money.currency };
  }

  if (!unit || isAttachedUnit(unit)) {
    return { label, numberUnit: unit };
  }

  return { label: `${label} (${unit})`, numberUnit: null };
}
