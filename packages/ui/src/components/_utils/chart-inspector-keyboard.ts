export type ChartPointNavigation = { currentIndex: number; key: string; totalPoints: number };

/** For points drawn in one row; null for a key that doesn't move between them. */
export function getChartPointTargetIndex({
  currentIndex,
  key,
  totalPoints,
}: ChartPointNavigation): number | null {
  if (key === "ArrowLeft") {
    return Math.max(0, currentIndex - 1);
  }

  if (key === "ArrowRight") {
    return Math.min(totalPoints - 1, currentIndex + 1);
  }

  if (key === "Home") {
    return 0;
  }

  if (key === "End") {
    return totalPoints - 1;
  }

  return null;
}
