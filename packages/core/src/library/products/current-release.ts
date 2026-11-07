/** `releasedAt` is the first day of the month when the pages give only the month. */
export type DatedRelease = { id: string; releasedAt: Date | null; releasedMonthOnly: boolean };

/** "2025-10-21", or "2025-10" for a release the pages date only by month. */
export function formatReleaseDate({
  releasedAt,
  releasedMonthOnly,
}: Pick<DatedRelease, "releasedAt" | "releasedMonthOnly">): string | null {
  const length = releasedMonthOnly ? "YYYY-MM".length : "YYYY-MM-DD".length;
  return releasedAt?.toISOString().slice(0, length) ?? null;
}

/** The first day of the month after `date`'s. */
export function toNextMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

/**
 * When a release counts as out: its day, or, for one the pages date only by month, once that month
 * has ended, so an announced release never takes over early.
 */
function toOutAt({ releasedAt, releasedMonthOnly }: DatedRelease): Date | null {
  return releasedAt && releasedMonthOnly ? toNextMonth(releasedAt) : releasedAt;
}

export function isReleased({ now, release }: { now: Date; release: DatedRelease }): boolean {
  const outAt = toOutAt(release);
  return outAt !== null && outAt <= now;
}

/** An unknown date counts as the oldest; releases out the same day go to the one stored last. */
export function isNewer(first: DatedRelease, second: DatedRelease): boolean {
  const byDate = (toOutAt(first)?.getTime() ?? 0) - (toOutAt(second)?.getTime() ?? 0);
  return byDate === 0 ? first.id > second.id : byDate > 0;
}

/**
 * The newest release already out. An announced release (a later date, or a month not over yet) and
 * one with no known date are never current.
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
