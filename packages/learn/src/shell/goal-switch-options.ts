/**
 * With no goal to follow or start, the switcher is the plain "Start a goal" link; a quick
 * explanation isn't a goal to switch to.
 */
export function hasNothingToSwitch({
  goals,
  waitingGoals,
}: {
  goals: readonly { kind: string }[];
  waitingGoals: readonly unknown[];
}): boolean {
  return goals.every((goal) => goal.kind === "explain") && waitingGoals.length === 0;
}
