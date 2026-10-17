import { type MockCandidate } from "./mock-plan";

/** What a section asks at once: a question on its own, or a set's questions in the set's order. */
type Unit = readonly MockCandidate[];

/** A set's questions in the pool, in the set's order. */
function getSetMembers({
  pool,
  setId,
}: {
  pool: readonly MockCandidate[];
  setId: string;
}): MockCandidate[] {
  return pool
    .filter((candidate) => candidate.set?.id === setId)
    .toSorted((first, second) => (first.set?.position ?? 0) - (second.set?.position ?? 0));
}

/**
 * The pool as a section asks it, in the pool's order: each question on its own, and each set
 * whole where its first question comes; a set whose questions aren't all in the pool is left out.
 */
function toUnits(pool: readonly MockCandidate[]): Unit[] {
  const seen = new Set<string>();

  return pool.flatMap((candidate): Unit[] => {
    const { set } = candidate;

    if (!set) {
      return [[candidate]];
    }

    if (seen.has(set.id)) {
      return [];
    }

    seen.add(set.id);
    const members = getSetMembers({ pool, setId: set.id });

    return members.length === set.size ? [members] : [];
  });
}

/** Whether each of the unit's formats still has room for its questions. */
function fitsQuotas({ left, unit }: { left: ReadonlyMap<string, number>; unit: Unit }): boolean {
  const byFormat = Map.groupBy(unit, (candidate) => candidate.format ?? "");
  return [...byFormat].every(([key, members]) => (left.get(key) ?? 0) >= members.length);
}

/**
 * The questions a section takes from its pool, up to `wanted`: a question on its own, or a set
 * whole (a text several questions read), its questions together in the set's order, as the exam
 * prints them. A set the section has no room left for, or whose questions aren't all in the pool,
 * waits for another mock. With the exam's formats' `quotas` (`getFormatQuotas`), each format
 * first takes its share in the pool's order, then any question fills the room a format short of
 * questions left; the section asks them format by format, in the quotas' order, as exams print
 * them. Without, it takes the pool's order.
 */
export function takeQuestions({
  pool,
  quotas = new Map(),
  wanted,
}: {
  pool: readonly MockCandidate[];
  quotas?: ReadonlyMap<string, number>;
  wanted: number;
}): string[] {
  const units = toUnits(pool);
  const left = new Map(quotas);
  const taken = new Set<number>();
  let room = wanted;

  const take = ({ byQuota }: { byQuota: boolean }) => {
    for (const [index, unit] of units.entries()) {
      const fits = !taken.has(index) && unit.length <= room;

      if (fits && (!byQuota || fitsQuotas({ left, unit }))) {
        taken.add(index);
        room -= unit.length;

        for (const candidate of unit) {
          const key = candidate.format ?? "";
          left.set(key, (left.get(key) ?? 0) - 1);
        }
      }
    }
  };

  if (quotas.size > 1) {
    take({ byQuota: true });
  }

  take({ byQuota: false });

  const order = [...quotas.keys()];

  const rank = (unit: Unit) => {
    const at = order.indexOf(unit[0]?.format ?? "");
    return at === -1 ? order.length : at;
  };

  return [...taken]
    .toSorted((first, second) => first - second)
    .map((index) => units[index] ?? [])
    .toSorted((first, second) => (quotas.size > 1 ? rank(first) - rank(second) : 0))
    .flatMap((unit) => unit.map((candidate) => candidate.itemId));
}
