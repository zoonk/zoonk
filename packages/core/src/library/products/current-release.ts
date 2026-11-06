type DatedRelease = { id: string; releasedAt: Date | null };

function isReleased({ now, release }: { now: Date; release: DatedRelease }): boolean {
  return release.releasedAt !== null && release.releasedAt <= now;
}

function compareNewestFirst(first: DatedRelease, second: DatedRelease): number {
  const byDate = (second.releasedAt?.getTime() ?? 0) - (first.releasedAt?.getTime() ?? 0);
  return byDate === 0 ? second.id.localeCompare(first.id) : byDate;
}

/**
 * The newest release whose date has passed. An announced release (a later date) and one with no
 * known date are never current; releases out the same day go to the one stored last.
 */
export function pickCurrentRelease<TRelease extends DatedRelease>({
  now,
  releases,
}: {
  now: Date;
  releases: readonly TRelease[];
}): TRelease | null {
  return (
    releases
      .filter((release) => isReleased({ now, release }))
      .toSorted((first, second) => compareNewestFirst(first, second))[0] ?? null
  );
}
