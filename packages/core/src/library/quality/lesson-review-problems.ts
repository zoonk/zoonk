export function toReviewProblems(
  issues: readonly { problem: string; fix: string; screen: number | null }[],
) {
  return issues.map(({ problem, fix, screen }) => ({
    problem: `${problem} Fix: ${fix}`,
    screen,
    source: "review" as const,
  }));
}
