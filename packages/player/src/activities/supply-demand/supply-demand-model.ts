/** A straight curve: price = intercept + slope × quantity. */
export type Line = { intercept: number; slope: number };

export type Curve = "demand" | "supply";

/** How far each curve is moved right (positive) or left, in units of quantity. */
export type CurveOffsets = Record<Curve, number>;

export type Point = { price: number; quantity: number };

const HEADROOM = 1.25;
const MIN_SPAN = 1;
/** Drag steps per real shift, so the real one lands exactly on a step. */
const STEPS_PER_SHIFT = 4;
/** Float noise allowed when comparing crossings, relative to their size. */
const RELATIVE_SLACK = 1e-9;

/**
 * Moving a curve right by `offset` means every price now goes with `offset` more quantity. This
 * matches core's template, so the drawing and the check agree on where a shifted curve lies.
 */
export function shiftLine(line: Line, offset: number): Line {
  return { intercept: line.intercept - line.slope * offset, slope: line.slope };
}

export function priceAt(line: Line, quantity: number): number {
  return line.intercept + line.slope * quantity;
}

export function quantityAt(line: Line, price: number): number {
  return line.slope === 0 ? 0 : (price - line.intercept) / line.slope;
}

export function equilibrium(supply: Line, demand: Line): Point {
  const quantity = (demand.intercept - supply.intercept) / (supply.slope - demand.slope);
  return { price: priceAt(supply, quantity), quantity };
}

export function shiftedCurves(fields: { demand: Line; supply: Line }, offsets: CurveOffsets) {
  return {
    demand: shiftLine(fields.demand, offsets.demand),
    supply: shiftLine(fields.supply, offsets.supply),
  };
}

/** Only one curve moves at a time, so the answer names one curve and one direction. */
export function moveCurve(curve: Curve, offset: number): CurveOffsets {
  return curve === "demand" ? { demand: offset, supply: 0 } : { demand: 0, supply: offset };
}

/** The learner's move as the template's answer, or null while nothing has moved. */
export function curveShiftAnswer(offsets: CurveOffsets) {
  if (offsets.demand === 0 && offsets.supply === 0) {
    return null;
  }

  const curve: Curve = offsets.demand === 0 ? "supply" : "demand";

  return { curve, direction: offsets[curve] > 0 ? "right" : "left", kind: "curveShift" } as const;
}

/** How far a curve can be dragged: twice the real shift each way, in quarter steps of it. */
export function shiftRange(amount: number) {
  return { max: amount * 2, min: -amount * 2, step: amount / STEPS_PER_SHIFT };
}

/**
 * Axes that fit both curves in every position the learner can drag them to, with room above
 * the highest crossing, starting at zero price and quantity.
 */
export function chartDomain(fields: { demand: Line; shift: { amount: number }; supply: Line }) {
  const { max } = shiftRange(fields.shift.amount);
  const offsets = [-max, 0, max];

  const points = offsets.flatMap((offset) => [
    equilibrium(shiftLine(fields.supply, offset), fields.demand),
    equilibrium(fields.supply, shiftLine(fields.demand, offset)),
  ]);

  const demandReach = offsets.map((offset) => quantityAt(shiftLine(fields.demand, offset), 0));
  const quantity = Math.max(...points.map((point) => point.quantity), ...demandReach, MIN_SPAN);
  const price = Math.max(...points.map((point) => point.price), fields.demand.intercept, MIN_SPAN);

  return { price: price * HEADROOM, quantity: quantity * HEADROOM };
}

/** Which way a value moved, for words like "the price goes up". */
export function changeDirection(before: number, after: number): "down" | "same" | "up" {
  const slack = Math.max(Math.abs(before), 1) * RELATIVE_SLACK;

  if (Math.abs(after - before) <= slack) {
    return "same";
  }

  return after > before ? "up" : "down";
}
