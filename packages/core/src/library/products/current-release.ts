type DatedRelease = { id: string; releasedAt: Date | null };

export function isReleased({ now, release }: { now: Date; release: DatedRelease }): boolean {
  return release.releasedAt !== null && release.releasedAt <= now;
}

/** An unknown date counts as the oldest; releases out the same day go to the one stored last. */
export function isNewer(first: DatedRelease, second: DatedRelease): boolean {
  const byDate = (first.releasedAt?.getTime() ?? 0) - (second.releasedAt?.getTime() ?? 0);
  return byDate === 0 ? first.id > second.id : byDate > 0;
}

/**
 * The newest release whose date has passed. An announced release (a later date) and one with no
 * known date are never current.
 */
export function pickCurrentRelease<TRelease extends DatedRelease>({
  now,
  releases,
}: {
  now: Date;
  releases: readonly TRelease[];
}): TRelease | null {
  return releases
    .filter((release) => isReleased({ now, release }))
    .reduce<TRelease | null>(
      (newest, release) => (newest && isNewer(newest, release) ? newest : release),
      null,
    );
}
