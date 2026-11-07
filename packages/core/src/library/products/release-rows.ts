import { toNextMonth } from "./current-release";
import { toNameKey } from "./product-keys";

export type ResearchedRelease = {
  name: string;
  releasedAt: Date | null;
  releasedMonthOnly: boolean;
  sourceId: string | null;
  supportEndsAt: Date | null;
  version: string | null;
};

export type ReleaseRow = ResearchedRelease & { normalizedName: string };

export function toReleaseRows(releases: readonly ResearchedRelease[]): ReleaseRow[] {
  const rows = releases.flatMap((release) => {
    const normalizedName = toNameKey(release.name);
    return normalizedName ? [{ ...release, normalizedName }] : [];
  });

  return [...new Map(rows.map((row) => [row.normalizedName, row])).values()];
}

export type StoredRelease = { releasedAt: Date | null; releasedMonthOnly: boolean };

/** A month a later page states never replaces a day already known in that month. */
function keepsKnownDay({ release, stored }: { release: ReleaseRow; stored: StoredRelease }) {
  const { releasedAt } = release;

  return (
    releasedAt !== null &&
    release.releasedMonthOnly &&
    !stored.releasedMonthOnly &&
    stored.releasedAt !== null &&
    stored.releasedAt >= releasedAt &&
    stored.releasedAt < toNextMonth(releasedAt)
  );
}

/** A later reading fills in or corrects what it states; what it leaves out stays as saved. */
export function toStatedFields({
  release,
  stored,
}: {
  release: ReleaseRow;
  stored: StoredRelease;
}) {
  const { releasedAt, releasedMonthOnly } = release;

  return {
    ...(releasedAt && !keepsKnownDay({ release, stored }) ? { releasedAt, releasedMonthOnly } : {}),
    ...Object.fromEntries(
      Object.entries({
        sourceId: release.sourceId,
        supportEndsAt: release.supportEndsAt,
        version: release.version,
      }).filter(([, value]) => value !== null),
    ),
  };
}
