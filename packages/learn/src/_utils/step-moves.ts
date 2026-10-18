/** A step as the moves between steps see it: from `lg` a step `beside` is in the aside instead. */
type StepPlace = { beside?: boolean };

/**
 * Where a step stands among the steps one screen size shows (`wide`: from `lg`, which skips the
 * steps beside it): its place and how many there are, for the dots, and where Back and Continue
 * lead (-1 for nowhere).
 */
export function getStepMoves({
  current,
  steps,
  wide,
}: {
  current: number;
  steps: readonly StepPlace[];
  wide: boolean;
}): { back: number; next: number; position: number; total: number } {
  const isShown = (step: StepPlace) => !wide || !step.beside;

  return {
    back: steps.findLastIndex((step, index) => index < current && isShown(step)),
    next: steps.findIndex((step, index) => index > current && isShown(step)),
    position: steps.filter((step, index) => index < current && isShown(step)).length,
    total: steps.filter((step) => isShown(step)).length,
  };
}
