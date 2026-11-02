import { apportion } from "@zoonk/utils/apportion";
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
  const subjects = [...Map.groupBy(pool, (item) => item.area).values()];
  const size = Math.min(wanted * 2, pool.length);
  const quotas = apportion({ total: size, weights: subjects.map((items) => items.length) });
  const easierQuotas = apportion({ total: Math.ceil(size / 2), weights: quotas });

  const routes = subjects.map((items, index) => {
    const sorted = items.toSorted(byDifficulty);
    const easier = easierQuotas[index] ?? 0;
    const harder = (quotas[index] ?? 0) - easier;

    return {
      easier: sorted.slice(0, easier).map((item) => item.itemId),
      harder: sorted
        .toReversed()
        .slice(0, harder)
        .map((item) => item.itemId),
    };
  });

  return {
    easier: routes.flatMap((route) => route.easier),
    harder: routes.flatMap((route) => route.harder),
  };
}
