export type SortKey =
  | "modelName"
  | "provider"
  | "reasoning"
  | "averageScore"
  | "latencyP50"
  | "latencyP95"
  | "costPer1000Runs";
export type SortDirection = "asc" | "desc";

/** What both leaderboards' rows have; only the scored-one-by-one rows carry a reasoning level. */
export type SortableEntry = {
  averageScore: number | null;
  costPer1000Runs: number | null;
  latencyP50: number | null;
  latencyP95: number | null;
  modelName: string;
  provider: string;
  reasoning?: string;
};

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

function compareEntries(a: SortableEntry, b: SortableEntry, key: SortKey): number {
  if (key === "averageScore") {
    if (a.averageScore === null || b.averageScore === null) {
      return 0;
    }

    const aRounded = roundScoreToFixed(a.averageScore);
    const bRounded = roundScoreToFixed(b.averageScore);
    const byScore = aRounded - bRounded;

    if (byScore !== 0) {
      return byScore;
    }

    return (b.latencyP50 ?? 0) - (a.latencyP50 ?? 0);
  }

  if (key === "costPer1000Runs" || key === "latencyP50" || key === "latencyP95") {
    return (a[key] ?? 0) - (b[key] ?? 0);
  }

  return (a[key] ?? "").localeCompare(b[key] ?? "");
}

export function sortLeaderboardEntries<Entry extends SortableEntry>(
  entries: Entry[],
  key: SortKey,
  direction: SortDirection,
): Entry[] {
  const sign = direction === "asc" ? 1 : -1;

  return [...entries].toSorted((left, right) => {
    if (left[key] === null || right[key] === null) {
      return Number(left[key] === null) - Number(right[key] === null);
    }

    return sign * compareEntries(left, right, key);
  });
}
