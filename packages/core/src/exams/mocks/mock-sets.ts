import { type MockCandidate } from "./mock-plan";

type Unit = readonly MockCandidate[];

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

function fitsQuotas({ left, unit }: { left: ReadonlyMap<string, number>; unit: Unit }): boolean {
  const byFormat = Map.groupBy(unit, (candidate) => candidate.format ?? "");
  return [...byFormat].every(([key, members]) => (left.get(key) ?? 0) >= members.length);
}

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
