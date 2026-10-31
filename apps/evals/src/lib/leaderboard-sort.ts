import { type LeaderboardEntry } from "./leaderboard";

export type SortKey =
  | "modelName"
  | "provider"
  | "reasoning"
  | "averageScore"
  | "latencyP50"
  | "latencyP95"
  | "costPer1000Runs";
export type SortDirection = "asc" | "desc";

function roundScoreToFixed(score: number): number {
  return Number(score.toFixed(2));
}

const NUMERIC_SORT_KEYS = new Set<SortKey>([
  "averageScore",
  "costPer1000Runs",
  "latencyP50",
  "latencyP95",
]);

export function getDefaultSortDirection(key: SortKey): SortDirection {
  return NUMERIC_SORT_KEYS.has(key) ? "desc" : "asc";
}

function compareEntries(a: LeaderboardEntry, b: LeaderboardEntry, key: SortKey): number {
  if (key === "averageScore") {
    const aRounded = roundScoreToFixed(a.averageScore);
    const bRounded = roundScoreToFixed(b.averageScore);
    const byScore = aRounded - bRounded;

    if (byScore !== 0) {
      return byScore;
    }

    return b.latencyP50 - a.latencyP50;
  }

  if (key === "costPer1000Runs" || key === "latencyP50" || key === "latencyP95") {
    return a[key] - b[key];
  }

  return a[key].localeCompare(b[key]);
}

export function sortLeaderboardEntries(
  entries: LeaderboardEntry[],
  key: SortKey,
  direction: SortDirection,
): LeaderboardEntry[] {
  const sign = direction === "asc" ? 1 : -1;
  return [...entries].toSorted((left, right) => sign * compareEntries(left, right, key));
}
