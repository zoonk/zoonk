import { namesMatch } from "../_utils/name-match";
import { type MockCandidate } from "./mock-plan";

/**
 * An adaptive exam's later module: its questions wait for the module before it. A learner who did
 * well there gets the harder set, like the digital SAT's second module.
 */
export type MockRouting = { easier: string[]; harder: string[] };

function byDifficulty(first: MockCandidate, second: MockCandidate): number {
  return (first.difficulty ?? 0) - (second.difficulty ?? 0);
}

/** A module's name without its number: "Math, module 2" is "Math, module". */
function withoutNumbers(name: string): string {
  return name.replaceAll(/\d+/gu, " ");
}

/** Two names for the same subject's modules ("Math, module 1" and "Math, module 2"). */
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

  return {
    easier: sorted.slice(0, wanted).map((item) => item.itemId),
    harder: sorted
      .toReversed()
      .slice(0, wanted)
      .map((item) => item.itemId),
  };
}
