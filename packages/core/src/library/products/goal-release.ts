import {
  type DatedRelease,
  isReleased,
  pickCurrentRelease,
  pickNewestByVersion,
} from "./current-release";
import { type GoalProductLink } from "./link-goal-product";
import { toNameKey } from "./product-keys";

type LinkedRelease = DatedRelease & { version: string | null };

/**
 * Decision 8: a learner who names a stored release other than the current one studies it in its
 * pinned course. An undated one counts as older, since a model page often gives only years; one
 * not out yet (a later date, or a month not over) is announced, so the goal follows the main course.
 * While no release is current, the newest listed one by version is the release the main course
 * takes once its own page dates it (`readProductReleases`), so naming it follows the main course.
 * When versions don't compare, as on a models page, nothing is looked up and the named one pins.
 */
export function toGoalProductLink({
  named,
  now,
  productId,
  releases,
}: {
  named: LinkedRelease | null;
  now: Date;
  productId: string;
  releases: readonly LinkedRelease[];
}): GoalProductLink {
  const current = pickCurrentRelease({ now, releases });

  if (!named || named.id === current?.id) {
    return { productId, productReleaseId: null };
  }

  const newest = current ? null : pickNewestByVersion(releases);

  const isOlder =
    named.releasedAt === null
      ? current !== null || newest?.id !== named.id
      : isReleased({ now, release: named });

  return { productId, productReleaseId: isOlder ? named.id : null };
}

/** The link for a product research just saved, from its releases and the learner's named one. */
export function linkSavedProduct({
  learnerRelease,
  now,
  productId,
  releases,
}: {
  learnerRelease: string | null;
  now: Date;
  productId: string;
  releases: readonly (LinkedRelease & { normalizedName: string })[];
}): GoalProductLink {
  const key = learnerRelease ? toNameKey(learnerRelease) : null;

  return toGoalProductLink({
    named: releases.find((release) => release.normalizedName === key) ?? null,
    now,
    productId,
    releases,
  });
}
