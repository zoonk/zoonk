type SolverChoice = { id: string; isCorrect: boolean };
type SolverStep = { choices: readonly SolverChoice[]; id: string };

/** Choices the learner picked on each step, in order. The first pick is the one that counts. */
export type SolverPicks = Readonly<Record<string, readonly string[]>>;

function correctChoiceId(step: SolverStep): string | null {
  return step.choices.find((choice) => choice.isCorrect)?.id ?? null;
}

function isStepSolved(step: SolverStep, picks: SolverPicks): boolean {
  const correct = correctChoiceId(step);
  return correct !== null && (picks[step.id] ?? []).includes(correct);
}

/** The first step still waiting for its right move, or the step count when all are solved. */
export function currentStepIndex(steps: readonly SolverStep[], picks: SolverPicks): number {
  const index = steps.findIndex((step) => !isStepSolved(step, picks));
  return index === -1 ? steps.length : index;
}

/**
 * The learner's answer once every step is solved: each step's first pick, so finding the right
 * move after a wrong one still teaches but doesn't count as knowing it.
 */
export function firstPicks(
  steps: readonly SolverStep[],
  picks: SolverPicks,
): Record<string, string> | null {
  if (currentStepIndex(steps, picks) < steps.length) {
    return null;
  }

  return Object.fromEntries(steps.map((step) => [step.id, picks[step.id]?.[0] ?? ""]));
}

export function addPick(picks: SolverPicks, stepId: string, choiceId: string): SolverPicks {
  const current = picks[stepId] ?? [];
  return current.includes(choiceId) ? picks : { ...picks, [stepId]: [...current, choiceId] };
}
