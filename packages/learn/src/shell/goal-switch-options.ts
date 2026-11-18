/** With nothing to switch to, the switcher is the plain "Start a goal" link. */
export function hasNothingToSwitch({
  goals,
  waitingGoals,
}: {
  goals: readonly unknown[];
  waitingGoals: readonly unknown[];
}): boolean {
  return goals.length === 0 && waitingGoals.length === 0;
}
