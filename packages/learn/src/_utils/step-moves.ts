type StepPlace = { beside?: boolean };

/** Back and Continue lead to -1 when there's nowhere to go. */
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
