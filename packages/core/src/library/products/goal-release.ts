import { pickCurrentRelease } from "./current-release";
import { type GoalProductLink } from "./link-goal-product";
import { toNameKey } from "./product-keys";

type DatedRelease = { id: string; releasedAt: Date | null };

/**
 * Decision 8: a goal keeps a release only when the learner named one that came out before the
 * current one, which they then study in its pinned course. A named current or announced release, or
 * one with no known date, follows the main course.
 */
export function toGoalProductLink({
  current,
  named,
  productId,
}: {
  current: DatedRelease | null;
  named: DatedRelease | null;
  productId: string;
}): GoalProductLink {
  const namedAt = named?.releasedAt ?? null;
  const currentAt = current?.releasedAt ?? null;

  const isOlder = named !== null && namedAt !== null && currentAt !== null && namedAt < currentAt;

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
  releases: readonly (DatedRelease & { normalizedName: string })[];
}): GoalProductLink {
  const key = learnerRelease ? toNameKey(learnerRelease) : null;

  return toGoalProductLink({
    current: pickCurrentRelease({ now, releases }),
    named: releases.find((release) => release.normalizedName === key) ?? null,
    productId,
  });
}
