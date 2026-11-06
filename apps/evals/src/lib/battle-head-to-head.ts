import { average } from "./math";
import { getBaseTestCaseId } from "./test-case-runs";
import { type BattleMatchup, type ModelRanking } from "./types";

/** Weighted scores closer than this count as a tie. */
const TIE_MARGIN = 0.05;
const Z_95 = 1.96;

export type HeadToHead = {
  judgeId: string;
  first: string;
  second: string;
  /** Case-runs where the judge scored `first` higher, about the same or lower. */
  wins: number;
  ties: number;
  losses: number;
  /** `first` minus `second`, averaged over each case's runs and then over cases. */
  meanDifference: number;
  /** Half the 95% interval of `meanDifference` across cases; null with fewer than 2 cases. */
  margin: number | null;
  /** The same difference for each score category, by category id. */
  categoryDifferences: Record<string, number>;
  cases: number;
};

type PairRuns = Map<string, { categories: Record<string, number>; score: number }[]>;

function differenceOf(first: ModelRanking, second: ModelRanking) {
  const categories = Object.fromEntries(
    (first.categoryScores ?? []).flatMap((category) => {
      const other = second.categoryScores?.find(
        (score) => score.categoryId === category.categoryId,
      );

      return other ? [[category.categoryId, category.score - other.score]] : [];
    }),
  );

  return { categories, score: first.score - second.score };
}

function marginOf(caseMeans: number[]): number | null {
  if (caseMeans.length < 2) {
    return null;
  }

  const mean = average(caseMeans);

  const variance =
    caseMeans.reduce((total, value) => total + (value - mean) ** 2, 0) / (caseMeans.length - 1);

  return (Z_95 * Math.sqrt(variance)) / Math.sqrt(caseMeans.length);
}

function summarize({ key, runs }: { key: string; runs: PairRuns }): HeadToHead {
  const [judgeId = "", first = "", second = ""] = JSON.parse(key) as string[];
  const all = [...runs.values()].flat();
  const caseMeans = [...runs.values()].map((caseRuns) => average(caseRuns.map((run) => run.score)));
  const categoryIds = [...new Set(all.flatMap((run) => Object.keys(run.categories)))];

  const categoryDifferences = Object.fromEntries(
    categoryIds.map((categoryId) => [
      categoryId,
      average(
        [...runs.values()].map((caseRuns) =>
          average(caseRuns.flatMap((run) => run.categories[categoryId] ?? [])),
        ),
      ),
    ]),
  );

  return {
    cases: caseMeans.length,
    categoryDifferences,
    first,
    judgeId,
    losses: all.filter((run) => run.score < -TIE_MARGIN).length,
    margin: marginOf(caseMeans),
    meanDifference: average(caseMeans),
    second,
    ties: all.filter((run) => Math.abs(run.score) <= TIE_MARGIN).length,
    wins: all.filter((run) => run.score > TIE_MARGIN).length,
  };
}

/**
 * Compares two models only through a judge that scored both on the same case-run, so judges'
 * different severities never mix. A case's runs are averaged before cases are, so the margin
 * reflects the spread across cases, not how many runs each had.
 */
export function compareWithinJudges(matchups: BattleMatchup[]): HeadToHead[] {
  const pairs = new Map<string, PairRuns>();

  for (const matchup of matchups) {
    const caseId = getBaseTestCaseId(matchup.testCaseId);

    for (const judgment of matchup.judgments) {
      const rankings = judgment.rankings.toSorted((a, b) => a.modelId.localeCompare(b.modelId));

      rankings.forEach((first, index) => {
        for (const second of rankings.slice(index + 1)) {
          const key = JSON.stringify([judgment.judgeId, first.modelId, second.modelId]);
          const runs: PairRuns = pairs.get(key) ?? new Map();
          runs.set(caseId, [...(runs.get(caseId) ?? []), differenceOf(first, second)]);
          pairs.set(key, runs);
        }
      });
    }
  }

  return [...pairs].map(([key, runs]) => summarize({ key, runs }));
}
