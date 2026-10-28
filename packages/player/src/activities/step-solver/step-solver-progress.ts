type SolverChoice = { id: string; isCorrect: boolean };
type SolverStep = { choices: readonly SolverChoice[]; id: string };

export type SolverPicks = Readonly<Record<string, readonly string[]>>;

function correctChoiceId(step: SolverStep): string | null {
  return step.choices.find((choice) => choice.isCorrect)?.id ?? null;
}

function isStepSolved(step: SolverStep, picks: SolverPicks): boolean {
  const correct = correctChoiceId(step);
  return correct !== null && (picks[step.id] ?? []).includes(correct);
}

export function currentStepIndex(steps: readonly SolverStep[], picks: SolverPicks): number {
  const index = steps.findIndex((step) => !isStepSolved(step, picks));
  return index === -1 ? steps.length : index;
}

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
