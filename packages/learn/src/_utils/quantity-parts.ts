/** A run of a formatted quantity: a number (with its "~" or sign) or the words and units around it. */
type QuantityPart = { numeric: boolean; text: string };

/** A number with its "~" or sign, and its percent sign when it's a share ("3.48%", "3,48 %"). */
const NUMBER_RUN = /(?<number>[~≈+\-−]?\d[\d.,:]*(?:[\u00A0\u202F]?%)?)/u;

/**
 * Splits a formatted quantity ("~2 h", "1 h 30 min", "~16") into its numbers and the units between
 * them, so a big number can set its digits large and its units small: in a monospaced face the
 * space before "h" is a whole digit wide and pushed the unit away ("~2   h"). A share keeps its
 * percent sign: "3.48%" is one figure, not a number and a unit.
 */
export function splitQuantity(text: string): QuantityPart[] {
  return text
    .split(NUMBER_RUN)
    .filter((part) => part !== "")
    .map((part) => ({ numeric: /^[~≈+\-−]?\d/u.test(part), text: part }));
}
