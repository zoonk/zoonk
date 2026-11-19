import { type MockResult } from "@zoonk/core/exams/mocks/contract";

type Area = MockResult["areas"][number];

function getAreaMeasure(area: Area): number {
  return area.score?.score ?? (area.total > 0 ? area.correct / area.total : 0);
}

/**
 * The subject that went best and the one to work on, only where the answers tell them apart. An
 * estimate ranks subjects even when nothing was answered, so a subject is the strongest only with a
 * right answer in it, and the one to work on only with a miss.
 */
export function getVerdictAreas(areas: readonly Area[]): { best: Area; worst: Area } | null {
  const ranked = areas.toSorted((a, b) => getAreaMeasure(b) - getAreaMeasure(a));
  const best = ranked[0];
  const worst = ranked.at(-1);

  if (!best || !worst || getAreaMeasure(best) === getAreaMeasure(worst)) {
    return null;
  }

  if (best.correct <= 0 || worst.correct >= worst.total) {
    return null;
  }

  return { best, worst };
}
