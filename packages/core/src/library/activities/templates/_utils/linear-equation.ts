import { evaluateOrNull, isClose } from "./template-helpers";

const ZERO_SLOPE = 1e-12;

export function solveLinearEquation(params: {
  left: string;
  right: string;
  variable: string;
}): number | null {
  const difference = `(${params.left}) - (${params.right})`;
  const at = (value: number) => evaluateOrNull(difference, { [params.variable]: value });
  const [atZero, atOne, atTwo] = [at(0), at(1), at(2)];

  if (atZero === null || atOne === null || atTwo === null) {
    return null;
  }

  const slope = atOne - atZero;

  if (Math.abs(slope) < ZERO_SLOPE || !isClose(atTwo, atZero + 2 * slope)) {
    return null;
  }

  const solution = -atZero / slope;
  const residual = at(solution);

  return residual !== null && isClose(residual + 1, 1) ? solution : null;
}
