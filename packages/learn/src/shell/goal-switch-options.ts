/**
 * With no goal to follow or start, the switcher is the plain "New goal" link. One quick
 * explanation Today already shows needs no menu; two or more keep it, which lists them.
 */
export function hasNothingToSwitch({
  goals,
  waitingGoals,
}: {
  goals: readonly { kind: string }[];
  waitingGoals: readonly unknown[];
}): boolean {
  return (
    goals.length <= 1 && goals.every((goal) => goal.kind === "explain") && waitingGoals.length === 0
  );
}
