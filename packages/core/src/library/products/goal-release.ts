import { type DatedRelease, isReleased, pickCurrentRelease } from "./current-release";
import { type GoalProductLink } from "./link-goal-product";
import { toNameKey } from "./product-keys";

/**
 * Decision 8: a learner who names a stored release other than the current one studies it in its
 * pinned course. An undated one counts as older, since a model page often gives only years; one
 * not out yet (a later date, or a month not over) is announced, so the goal follows the main course.
 */
export function toGoalProductLink({
  current,
  named,
  now,
  productId,
}: {
  current: DatedRelease | null;
  named: DatedRelease | null;
  now: Date;
  productId: string;
}): GoalProductLink {
  const isPinned =
    named !== null &&
    named.id !== current?.id &&
    (named.releasedAt === null || isReleased({ now, release: named }));

  return { productId, productReleaseId: isPinned ? named.id : null };
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
  releases: readonly (DatedRelease & { normalizedName: string })[];
}): GoalProductLink {
  const key = learnerRelease ? toNameKey(learnerRelease) : null;

  return toGoalProductLink({
    current: pickCurrentRelease({ now, releases }),
    named: releases.find((release) => release.normalizedName === key) ?? null,
    now,
    productId,
  });
}
