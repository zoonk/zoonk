import "server-only";
import { type ProductRelease, prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { pickCurrentRelease } from "./current-release";
import { toNameKey, toRegistrableDomain, toVersionKey } from "./product-keys";

const FRESH_RELEASES_DAYS = 7;

export type ProductHints = {
  brand: string;
  name: string;
  officialDomains: readonly string[];
  release: string | null;
};

function loadCandidates(nameKey: string) {
  return prisma.product.findMany({
    include: {
      organization: true,
      releases: true,
      releasesSource: { select: { contentHash: true, fetchedAt: true } },
    },
    where: { OR: [{ normalizedName: nameKey }, { aliases: { has: nameKey } }] },
  });
}

type Candidate = Awaited<ReturnType<typeof loadCandidates>>[number];

type FoundProduct = {
  currentRelease: ProductRelease | null;
  /** A releases page fetched within the last week whose saved releases were read from it. */
  isFresh: boolean;
  /** Null when the hints name no release or it isn't stored yet. */
  namedRelease: ProductRelease | null;
  product: Candidate;
};

function isNamedBrand({
  candidate,
  hints,
}: {
  candidate: Candidate;
  hints: ProductHints;
}): boolean {
  const { domain, name } = candidate.organization;
  const brandKey = toNameKey(hints.brand);

  const domains = new Set(
    hints.officialDomains.flatMap((officialDomain) => toRegistrableDomain(officialDomain) ?? []),
  );

  return (
    (domain !== null && domains.has(domain)) || (brandKey !== "" && toNameKey(name) === brandKey)
  );
}

function findNamedRelease({
  hint,
  product,
}: {
  hint: string;
  product: Candidate;
}): ProductRelease | null {
  const hintKey = toNameKey(hint);
  const byName = product.releases.find((release) => release.normalizedName === hintKey);

  const byVersion = product.releases.find(
    (release) =>
      release.version !== null &&
      (toVersionKey(release.version) === toVersionKey(hint) ||
        toNameKey(`${product.name} ${release.version}`) === hintKey),
  );

  return byName ?? byVersion ?? null;
}

function isFreshProduct({ now, product }: { now: Date; product: Candidate }): boolean {
  const source = product.releasesSource;

  if (!source) {
    return true;
  }

  const isRecent = now.getTime() - source.fetchedAt.getTime() < FRESH_RELEASES_DAYS * MS_PER_DAY;

  return isRecent && source.contentHash === product.releasesHash;
}

/**
 * Internal workflow bridge for research, which looks a product up from its plan's hints. A product
 * is found only under the brand the hints name, by domain or by name, and only when exactly one
 * matches, so a namesake under another brand is never linked.
 */
export async function findProduct({
  hints,
  now = new Date(),
}: {
  hints: ProductHints;
  now?: Date;
}): Promise<FoundProduct | null> {
  const nameKey = toNameKey(hints.name);

  if (!nameKey) {
    return null;
  }

  const candidates = await loadCandidates(nameKey);
  const matches = candidates.filter((candidate) => isNamedBrand({ candidate, hints }));
  const [product] = matches;

  if (!product || matches.length > 1) {
    return null;
  }

  return {
    currentRelease: pickCurrentRelease({ now, releases: product.releases }),
    isFresh: isFreshProduct({ now, product }),
    namedRelease: hints.release ? findNamedRelease({ hint: hints.release, product }) : null,
    product,
  };
}
