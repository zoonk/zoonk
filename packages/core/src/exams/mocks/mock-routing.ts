import { namesMatch } from "../_utils/name-match";
import { type MockCandidate } from "./mock-plan";

export type MockRouting = { easier: string[]; harder: string[] };

function byDifficulty(first: MockCandidate, second: MockCandidate): number {
  return (first.difficulty ?? 0) - (second.difficulty ?? 0);
}

function withoutNumbers(name: string): string {
  return name.replaceAll(/\d+/gu, " ");
}

export function isNextModule({
  current,
  previous,
}: {
  current: string | null;
  previous: string | null;
}) {
  return Boolean(
    current &&
    previous &&
    current !== previous &&
    namesMatch(withoutNumbers(current), withoutNumbers(previous)),
  );
}

export function toRouting({
  pool,
  wanted,
}: {
  pool: MockCandidate[];
  wanted: number;
}): MockRouting {
  const sorted = pool.toSorted(byDifficulty);
  const share = Math.min(wanted, Math.ceil(sorted.length / 2));

  return {
    easier: sorted.slice(0, share).map((item) => item.itemId),
    harder: sorted
      .toReversed()
      .slice(0, Math.min(wanted, Math.floor(sorted.length / 2)))
      .map((item) => item.itemId),
  };
}
